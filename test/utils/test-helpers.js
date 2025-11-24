/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Test utilities and helpers for DecentraFile tests
 */

const { ethers } = require("hardhat");
const crypto = require("crypto");

/**
 * Generate a test file hash from IPFS CID
 * @param {string} ipfsHash - IPFS CID
 * @returns {string} bytes32 fileHash
 */
function generateFileHash(ipfsHash) {
    return ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
}

/**
 * Generate random test data
 * @param {number} size - Size in bytes
 * @returns {Buffer} Random data
 */
function generateTestData(size) {
    return crypto.randomBytes(size);
}

/**
 * Generate deterministic test data (for reproducible tests)
 * @param {number} size - Size in bytes
 * @param {string} seed - Seed for determinism
 * @returns {Buffer} Deterministic data
 */
function generateDeterministicTestData(size, seed = "test") {
    const data = Buffer.alloc(size);
    const hash = crypto.createHash("sha256").update(seed).digest();

    for (let i = 0; i < size; i++) {
        data[i] = hash[i % hash.length];
    }

    return data;
}

/**
 * Create a test account with deterministic private key
 * @param {number} index - Account index
 * @returns {Object} Account object with address and privateKey
 */
function createTestAccount(index = 0) {
    const seed = `test-account-${index}`;
    const privateKey = "0x" + crypto.createHash("sha256").update(seed).digest("hex");
    const wallet = new ethers.Wallet(privateKey);

    return {
        address: wallet.address,
        privateKey,
        wallet
    };
}

/**
 * Wait for specified number of blocks
 * @param {number} blocks - Number of blocks to wait
 */
async function waitForBlocks(blocks) {
    for (let i = 0; i < blocks; i++) {
        await ethers.provider.send("evm_mine", []);
    }
}

/**
 * Increase time by specified seconds
 * @param {number} seconds - Seconds to increase
 */
async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
}

/**
 * Get current block timestamp
 * @returns {Promise<number>} Current timestamp
 */
async function getCurrentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

/**
 * Create a valid IPFS CID for testing
 * @param {Buffer} data - Data to hash
 * @returns {string} Mock IPFS CID
 */
function createMockIPFSCID(data) {
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    return `Qm${hash.substring(0, 44)}`;
}

/**
 * Assert that a buffer is zeroed
 * @param {Buffer} buffer - Buffer to check
 * @param {string} message - Assertion message
 */
function assertBufferZeroed(buffer, message = "Buffer should be zeroed") {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("Expected Buffer");
    }

    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] !== 0) {
            throw new Error(`${message}: Found non-zero byte at index ${i}`);
        }
    }
}

/**
 * Mask sensitive data for logging in tests
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters
 * @returns {string} Masked string
 */
function maskSensitiveData(data, visibleChars = 8) {
    if (!data || data.length <= visibleChars) {
        return "***";
    }
    return `${data.substring(0, visibleChars)}...`;
}

module.exports = {
    generateFileHash,
    generateTestData,
    generateDeterministicTestData,
    createTestAccount,
    waitForBlocks,
    increaseTime,
    getCurrentTimestamp,
    createMockIPFSCID,
    assertBufferZeroed,
    maskSensitiveData
};

