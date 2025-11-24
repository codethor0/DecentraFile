/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Mock IPFS client for testing
 * Provides deterministic behavior for unit and integration tests
 */

class MockIPFSClient {
    constructor() {
        this.files = new Map();
        this.pinnedFiles = new Set();
        this.shouldFail = false;
        this.failOperation = null;
        this.uploadDelay = 0;
        this.downloadDelay = 0;
    }

    /**
   * Reset mock state
   */
    reset() {
        this.files.clear();
        this.pinnedFiles.clear();
        this.shouldFail = false;
        this.failOperation = null;
        this.uploadDelay = 0;
        this.downloadDelay = 0;
    }

    /**
   * Configure mock to fail on specific operation
   * @param {string} operation - 'upload', 'download', or 'pin'
   */
    setFailure(operation) {
        this.shouldFail = true;
        this.failOperation = operation;
    }

    /**
   * Configure upload delay (for timeout testing)
   * @param {number} ms - Milliseconds to delay
   */
    setUploadDelay(ms) {
        this.uploadDelay = ms;
    }

    /**
   * Configure download delay (for timeout testing)
   * @param {number} ms - Milliseconds to delay
   */
    setDownloadDelay(ms) {
        this.downloadDelay = ms;
    }

    /**
   * Mock IPFS add operation
   * Returns a deterministic CID based on content hash
   */
    async add(file) {
        if (this.uploadDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.uploadDelay));
        }

        if (this.shouldFail && this.failOperation === "upload") {
            throw new Error("Mock IPFS upload failure");
        }

        const crypto = require("crypto");
        const hash = crypto.createHash("sha256").update(file).digest("hex");

        // Generate deterministic CID-like string (Qm prefix + exactly 44 base58 chars)
        // For testing, we use a simplified CID format that matches validation
        // Validation expects: Qm[1-9A-HJ-NP-Za-km-z]{44} (base58 without 0, O, I, l)
        const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let cid = "Qm";
        // Use hash bytes cyclically to deterministically select base58 chars
        for (let i = 0; i < 44; i++) {
            const byteIndex = i % (hash.length / 2);
            const byte = parseInt(hash.substring(byteIndex * 2, byteIndex * 2 + 2), 16);
            const charIndex = (byte + i) % base58Chars.length;
            cid += base58Chars[charIndex];
        }

        this.files.set(cid, Buffer.from(file));

        return {
            cid: {
                toString: () => cid
            },
            path: cid,
            size: file.length
        };
    }

    /**
   * Mock IPFS cat operation
   */
    async * cat(cid) {
        if (this.downloadDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.downloadDelay));
        }

        if (this.shouldFail && this.failOperation === "download") {
            throw new Error("Mock IPFS download failure");
        }

        if (!this.files.has(cid)) {
            throw new Error(`Mock IPFS: File not found: ${cid}`);
        }

        const file = this.files.get(cid);
        yield file;
    }

    /**
   * Mock IPFS pin operation
   */
    async pin() {
        return {
            add: async (cid) => {
                if (this.shouldFail && this.failOperation === "pin") {
                    throw new Error("Mock IPFS pin failure");
                }
                this.pinnedFiles.add(cid);
                return { cid };
            },
            rm: async (cid) => {
                this.pinnedFiles.delete(cid);
                return { cid };
            },
            ls: async () => {
                const results = [];
                for (const cid of this.pinnedFiles) {
                    results.push({ cid });
                }
                return results;
            }
        };
    }

    /**
   * Get stored file (for test verification)
   */
    getFile(cid) {
        return this.files.get(cid);
    }

    /**
   * Check if file is pinned
   */
    isPinned(cid) {
        return this.pinnedFiles.has(cid);
    }

    /**
   * Get all stored CIDs
   */
    getAllCids() {
        return Array.from(this.files.keys());
    }
}

module.exports = MockIPFSClient;

