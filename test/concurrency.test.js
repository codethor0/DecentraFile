/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Concurrency and race condition tests for DecentraFile
 * Tests IPFS mapping file concurrency, state consistency, and race mitigation
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
    generateFileHash,
    generateDeterministicTestData
} = require("./utils/test-helpers");
const MockIPFSClient = require("./utils/ipfs-mock");

describe("DecentraFile Concurrency Tests", function () {
    let fileRegistry;
    let testAccount;
    let mockIPFS;
    let tempDir;
    let mappingFile;

    before(function () {
        if (process.env.USE_REAL_IPFS_FOR_TESTS === "true") {
            this.skip();
        }
    });

    beforeEach(async function () {
        const [owner] = await ethers.getSigners();
        const FileRegistry = await ethers.getContractFactory("FileRegistry");
        fileRegistry = await FileRegistry.deploy();
        await fileRegistry.waitForDeployment();

        testAccount = owner;
        mockIPFS = new MockIPFSClient();

        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "decentrafile-concurrency-"));
        mappingFile = path.join(tempDir, "ipfs-mapping.json");
        process.env.IPFS_MAPPING_FILE = mappingFile;
    });

    afterEach(function () {
        if (mockIPFS) {
            mockIPFS.reset();
        }
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        delete process.env.IPFS_MAPPING_FILE;
    });

    describe("IPFS Mapping File Concurrency", function () {
        it("Should handle rapid sequential writes without losing entries", async function () {
            const fs = require("fs");
            const path = require("path");

            const mappingFile = process.env.IPFS_MAPPING_FILE;
            const loadMapping = () => {
                const mapping = new Map();
                if (mappingFile && fs.existsSync(mappingFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
                        for (const [fileHash, ipfsHash] of Object.entries(data)) {
                            mapping.set(fileHash, ipfsHash);
                        }
                    } catch (error) {
                        return new Map();
                    }
                }
                return mapping;
            };

            const saveMapping = (mapping) => {
                if (mappingFile) {
                    try {
                        const diskMapping = loadMapping();
                        for (const [fileHash, ipfsHash] of diskMapping.entries()) {
                            mapping.set(fileHash, ipfsHash);
                        }
                        const data = Object.fromEntries(mapping);
                        const jsonData = JSON.stringify(data, null, 2);
                        const tempFile = mappingFile + ".tmp";
                        fs.writeFileSync(tempFile, jsonData, "utf8");
                        fs.renameSync(tempFile, mappingFile);
                    } catch (error) {
                        const tempFile = mappingFile + ".tmp";
                        if (fs.existsSync(tempFile)) {
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (cleanupError) {
                            }
                        }
                    }
                }
            };

            const mapping = new Map();

            const entries = [];
            for (let i = 0; i < 20; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`concurrent-${i}`));
                const ipfsCID = `Qm${"a".repeat(44)}${i}`;
                entries.push({ fileHash, ipfsCID });
                mapping.set(fileHash, ipfsCID);
            }

            saveMapping(mapping);

            const loaded = loadMapping();
            expect(loaded.size).to.equal(20);

            for (const { fileHash, ipfsCID } of entries) {
                expect(loaded.get(fileHash)).to.equal(ipfsCID);
            }
        });

        it("Should merge disk state with in-memory state correctly", async function () {
            const fs = require("fs");

            const mappingFile = process.env.IPFS_MAPPING_FILE;
            const loadMapping = () => {
                const mapping = new Map();
                if (mappingFile && fs.existsSync(mappingFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
                        for (const [fileHash, ipfsHash] of Object.entries(data)) {
                            mapping.set(fileHash, ipfsHash);
                        }
                    } catch (error) {
                        return new Map();
                    }
                }
                return mapping;
            };

            const saveMapping = (mapping) => {
                if (mappingFile) {
                    try {
                        const diskMapping = loadMapping();
                        for (const [fileHash, ipfsHash] of diskMapping.entries()) {
                            mapping.set(fileHash, ipfsHash);
                        }
                        const data = Object.fromEntries(mapping);
                        const jsonData = JSON.stringify(data, null, 2);
                        const tempFile = mappingFile + ".tmp";
                        fs.writeFileSync(tempFile, jsonData, "utf8");
                        fs.renameSync(tempFile, mappingFile);
                    } catch (error) {
                        const tempFile = mappingFile + ".tmp";
                        if (fs.existsSync(tempFile)) {
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (cleanupError) {
                            }
                        }
                    }
                }
            };

            const diskMapping = new Map();
            diskMapping.set(ethers.keccak256(ethers.toUtf8Bytes("disk-1")), "Qm" + "b".repeat(44));
            diskMapping.set(ethers.keccak256(ethers.toUtf8Bytes("disk-2")), "Qm" + "c".repeat(44));

            const diskData = Object.fromEntries(diskMapping);
            fs.writeFileSync(mappingFile, JSON.stringify(diskData, null, 2), "utf8");

            const memoryMapping = new Map();
            memoryMapping.set(ethers.keccak256(ethers.toUtf8Bytes("memory-1")), "Qm" + "d".repeat(44));
            memoryMapping.set(ethers.keccak256(ethers.toUtf8Bytes("disk-1")), "Qm" + "e".repeat(44));

            saveMapping(memoryMapping);

            const loaded = loadMapping();
            expect(loaded.size).to.equal(3);
            expect(loaded.get(ethers.keccak256(ethers.toUtf8Bytes("disk-1")))).to.equal("Qm" + "b".repeat(44));
            expect(loaded.get(ethers.keccak256(ethers.toUtf8Bytes("disk-2")))).to.equal("Qm" + "c".repeat(44));
            expect(loaded.get(ethers.keccak256(ethers.toUtf8Bytes("memory-1")))).to.equal("Qm" + "d".repeat(44));
        });

        it("Should maintain atomic write pattern (no partial JSON)", async function () {
            const fs = require("fs");

            const mappingFile = process.env.IPFS_MAPPING_FILE;
            const saveMapping = (mapping) => {
                if (mappingFile) {
                    try {
                        const loadMapping = () => {
                            const m = new Map();
                            if (mappingFile && fs.existsSync(mappingFile)) {
                                try {
                                    const data = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
                                    for (const [fileHash, ipfsHash] of Object.entries(data)) {
                                        m.set(fileHash, ipfsHash);
                                    }
                                } catch (error) {
                                    return new Map();
                                }
                            }
                            return m;
                        };
                        const diskMapping = loadMapping();
                        for (const [fileHash, ipfsHash] of diskMapping.entries()) {
                            mapping.set(fileHash, ipfsHash);
                        }
                        const data = Object.fromEntries(mapping);
                        const jsonData = JSON.stringify(data, null, 2);
                        const tempFile = mappingFile + ".tmp";
                        fs.writeFileSync(tempFile, jsonData, "utf8");
                        fs.renameSync(tempFile, mappingFile);
                    } catch (error) {
                        const tempFile = mappingFile + ".tmp";
                        if (fs.existsSync(tempFile)) {
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (cleanupError) {
                            }
                        }
                    }
                }
            };
            const mapping = new Map();

            for (let i = 0; i < 10; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`atomic-${i}`));
                const ipfsCID = `Qm${"f".repeat(44)}${i}`;
                mapping.set(fileHash, ipfsCID);
            }

            saveMapping(mapping);

            const content = fs.readFileSync(mappingFile, "utf8");
            expect(() => JSON.parse(content)).to.not.throw();

            const tempFile = mappingFile + ".tmp";
            expect(fs.existsSync(tempFile)).to.be.false;
        });

        it("Should handle mapping file corruption gracefully", async function () {
            const fs = require("fs");
            const mappingFile = process.env.IPFS_MAPPING_FILE;
            const loadMapping = () => {
                const mapping = new Map();
                if (mappingFile && fs.existsSync(mappingFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
                        for (const [fileHash, ipfsHash] of Object.entries(data)) {
                            mapping.set(fileHash, ipfsHash);
                        }
                    } catch (error) {
                        return new Map();
                    }
                }
                return mapping;
            };

            fs.writeFileSync(mappingFile, "invalid json content", "utf8");

            const loaded = loadMapping();
            expect(loaded.size).to.equal(0);
        });

        it("Should handle missing mapping file gracefully", async function () {
            const fs = require("fs");
            const mappingFile = process.env.IPFS_MAPPING_FILE;
            const loadMapping = () => {
                const mapping = new Map();
                if (mappingFile && fs.existsSync(mappingFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
                        for (const [fileHash, ipfsHash] of Object.entries(data)) {
                            mapping.set(fileHash, ipfsHash);
                        }
                    } catch (error) {
                        return new Map();
                    }
                }
                return mapping;
            };

            if (fs.existsSync(mappingFile)) {
                fs.unlinkSync(mappingFile);
            }

            const loaded = loadMapping();
            expect(loaded.size).to.equal(0);
        });

        it("Should handle concurrent-like rapid operations", async function () {
            const fs = require("fs");
            const mappingFile = process.env.IPFS_MAPPING_FILE;
            const loadMapping = () => {
                const mapping = new Map();
                if (mappingFile && fs.existsSync(mappingFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
                        for (const [fileHash, ipfsHash] of Object.entries(data)) {
                            mapping.set(fileHash, ipfsHash);
                        }
                    } catch (error) {
                        return new Map();
                    }
                }
                return mapping;
            };

            const saveMapping = (mapping) => {
                if (mappingFile) {
                    try {
                        const diskMapping = loadMapping();
                        for (const [fileHash, ipfsHash] of diskMapping.entries()) {
                            mapping.set(fileHash, ipfsHash);
                        }
                        const data = Object.fromEntries(mapping);
                        const jsonData = JSON.stringify(data, null, 2);
                        const tempFile = mappingFile + ".tmp";
                        fs.writeFileSync(tempFile, jsonData, "utf8");
                        fs.renameSync(tempFile, mappingFile);
                    } catch (error) {
                        const tempFile = mappingFile + ".tmp";
                        if (fs.existsSync(tempFile)) {
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (cleanupError) {
                            }
                        }
                    }
                }
            };

            const operations = [];
            for (let i = 0; i < 50; i++) {
                const mapping = new Map();
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`rapid-${i}`));
                const ipfsCID = `Qm${"g".repeat(44)}${i}`;
                mapping.set(fileHash, ipfsCID);

                operations.push(() => {
                    const current = loadMapping();
                    for (const [hash, cid] of mapping.entries()) {
                        current.set(hash, cid);
                    }
                    saveMapping(current);
                });
            }

            for (const op of operations) {
                op();
            }

            const final = loadMapping();
            expect(final.size).to.equal(50);
        });
    });

    describe("Contract State Consistency Under Concurrency", function () {
        it("Should maintain consistent state with rapid sequential uploads", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const uploads = [];

            for (let i = 0; i < 30; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`state-test-${i}`));
                uploads.push(
                    fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey)
                );
            }

            await Promise.all(uploads);

            const fileCount = await fileRegistry.getUserFileCount(testAccount.address);
            expect(fileCount).to.equal(30);

            const userFiles = await fileRegistry.getUserFiles(testAccount.address);
            expect(userFiles.length).to.equal(30);

            for (let i = 0; i < 30; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`state-test-${i}`));
                const exists = await fileRegistry.fileExists(fileHash);
                expect(exists).to.be.true;
            }
        });

        it("Should prevent duplicate uploads even under rapid operations", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("duplicate-test"));

            await fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey);

            const duplicateAttempts = [];
            for (let i = 0; i < 5; i++) {
                duplicateAttempts.push(
                    fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey)
                        .then(() => ({ success: true }))
                        .catch((err) => ({ success: false, error: err }))
                );
            }

            const results = await Promise.all(duplicateAttempts);
            const successes = results.filter(r => r.success).length;
            expect(successes).to.equal(0);

            const fileCount = await fileRegistry.getUserFileCount(testAccount.address);
            expect(fileCount).to.equal(1);
        });
    });
});

