/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Integration tests for DecentraFile
 * Tests the interaction between blockchain, IPFS, and crypto modules
 * Uses mocked IPFS for deterministic testing
 *
 * Note: These tests verify the integration of components without requiring
 * a real IPFS daemon or external network connections
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const MockIPFSClient = require("./utils/ipfs-mock");
const {
    generateSymmetricKey,
    encryptFile,
    decryptFile,
    secureZero,
    AES_KEY_SIZE
} = require("../src/crypto/crypto");
const {
    generateFileHash,
    generateDeterministicTestData
} = require("./utils/test-helpers");

describe("DecentraFile Integration Tests", function () {
    let fileRegistry;
    let testAccount;
    let mockIPFS;

    before(function () {
    // Check if we should use real IPFS
        if (process.env.USE_REAL_IPFS_FOR_TESTS === "true") {
            this.skip();
        }
    });

    beforeEach(async function () {
    // Deploy contract
        const [owner] = await ethers.getSigners();
        const FileRegistry = await ethers.getContractFactory("FileRegistry");
        fileRegistry = await FileRegistry.deploy();
        await fileRegistry.waitForDeployment();

        // Create test account
        testAccount = owner;

        // Setup IPFS mock
        mockIPFS = new MockIPFSClient();
    });

    afterEach(function () {
    // Reset mock
        if (mockIPFS) {
            mockIPFS.reset();
        }
    });

    describe("Upload Flow Integration", function () {
        it("Should complete full upload flow: file -> encrypt -> IPFS -> blockchain", async function () {
            const testData = generateDeterministicTestData(1024, "test-file-1");

            // Step 1: Encrypt file
            const symmetricKey = generateSymmetricKey();
            const { ciphertext, iv, authTag } = encryptFile(testData, symmetricKey);

            expect(ciphertext).to.be.instanceOf(Buffer);
            expect(ciphertext.length).to.be.greaterThan(0);
            expect(iv).to.be.a("string");
            expect(authTag).to.be.a("string");

            // Step 2: Upload to IPFS (mocked)
            const ipfsResult = await mockIPFS.add(ciphertext);
            const ipfsCID = ipfsResult.cid.toString();

            expect(ipfsCID).to.match(/^Qm[a-zA-Z0-9]{44}$/);
            expect(mockIPFS.getFile(ipfsCID)).to.deep.equal(ciphertext);

            // Step 3: Generate fileHash
            const fileHash = generateFileHash(ipfsCID);

            // Step 4: Prepare encrypted key (simplified - using plaintext mode for testing)
            const keyMetadata = {
                iv,
                tag: authTag,
                key: symmetricKey.toString("hex")
            };
            const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

            // Step 5: Upload to blockchain (ethers.js expects hex string with 0x prefix for bytes)
            const tx = await fileRegistry.connect(testAccount).uploadFile(
                fileHash,
                "0x" + encryptedKey.toString("hex")
            );

            await expect(tx)
                .to.emit(fileRegistry, "FileUploaded")
                .withArgs(fileHash, testAccount.address, (timestamp) => timestamp > 0);

            // Verify on-chain data
            const metadata = await fileRegistry.getFileMetadata(fileHash);
            expect(metadata.owner).to.equal(testAccount.address);
            expect(metadata.timestamp).to.be.gt(0);

            // Verify file exists
            expect(await fileRegistry.fileExists(fileHash)).to.be.true;

            // Cleanup
            secureZero(symmetricKey);
        });

        it("Should handle upload with different file sizes", async function () {
            const sizes = [1, 100, 1024, 10 * 1024];

            for (const size of sizes) {
                const testData = generateDeterministicTestData(size, `test-${size}`);
                const symmetricKey = generateSymmetricKey();
                const { ciphertext } = encryptFile(testData, symmetricKey);

                const ipfsResult = await mockIPFS.add(ciphertext);
                const ipfsCID = ipfsResult.cid.toString();
                const fileHash = generateFileHash(ipfsCID);

                const keyMetadata = {
                    iv: "test-iv",
                    tag: "test-tag",
                    key: symmetricKey.toString("hex")
                };
                const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

                await fileRegistry.connect(testAccount).uploadFile(
                    fileHash,
                    "0x" + encryptedKey.toString("hex")
                );

                expect(await fileRegistry.fileExists(fileHash)).to.be.true;
                secureZero(symmetricKey);
            }
        });

        it("Should fail gracefully when IPFS upload fails", async function () {
            mockIPFS.setFailure("upload");

            const testData = generateDeterministicTestData(100, "test-fail");
            const symmetricKey = generateSymmetricKey();
            const { ciphertext } = encryptFile(testData, symmetricKey);

            await expect(mockIPFS.add(ciphertext)).to.be.rejectedWith("Mock IPFS upload failure");

            secureZero(symmetricKey);
        });
    });

    describe("Download Flow Integration", function () {
        let storedFileHash;
        let storedIPFSCID;
        let storedCiphertext;
        let storedSymmetricKey;
        let storedIV;
        let storedAuthTag;

        beforeEach(async function () {
            // Setup: Upload a file first
            const testData = generateDeterministicTestData(512, "download-test");
            storedSymmetricKey = generateSymmetricKey();
            const encrypted = encryptFile(testData, storedSymmetricKey);
            storedCiphertext = encrypted.ciphertext;
            storedIV = encrypted.iv;
            storedAuthTag = encrypted.authTag;

            const ipfsResult = await mockIPFS.add(storedCiphertext);
            storedIPFSCID = ipfsResult.cid.toString();
            storedFileHash = generateFileHash(storedIPFSCID);

            const keyMetadata = {
                iv: storedIV,
                tag: storedAuthTag,
                key: storedSymmetricKey.toString("hex")
            };
            const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

            await fileRegistry.connect(testAccount).uploadFile(
                storedFileHash,
                "0x" + encryptedKey.toString("hex")
            );
        });

        afterEach(function () {
            if (storedSymmetricKey) {
                secureZero(storedSymmetricKey);
            }
        });

        it("Should complete full download flow: blockchain -> IPFS -> decrypt -> file", async function () {
            // Step 1: Retrieve encrypted key from blockchain
            const encryptedKeyHex = await fileRegistry.downloadFile(storedFileHash);
            const encryptedKeyBuffer = Buffer.from(
                encryptedKeyHex.startsWith("0x") ? encryptedKeyHex.slice(2) : encryptedKeyHex,
                "hex"
            );

            // Step 2: Parse key metadata
            const keyData = JSON.parse(encryptedKeyBuffer.toString("utf8"));
            const symmetricKey = Buffer.from(keyData.key, "hex");
            const iv = keyData.iv;
            const authTag = keyData.tag;

            expect(symmetricKey.length).to.equal(AES_KEY_SIZE);

            // Step 3: Download from IPFS (mocked)
            const chunks = [];
            for await (const chunk of mockIPFS.cat(storedIPFSCID)) {
                chunks.push(chunk);
            }
            const downloadedCiphertext = Buffer.concat(chunks);

            expect(downloadedCiphertext).to.deep.equal(storedCiphertext);

            // Step 4: Decrypt
            const decryptedData = decryptFile(downloadedCiphertext, symmetricKey, iv, authTag);

            // Step 5: Verify decrypted data matches original
            const originalData = generateDeterministicTestData(512, "download-test");
            expect(decryptedData).to.deep.equal(originalData);

            // Cleanup
            secureZero(symmetricKey);
        });

        it("Should fail gracefully when IPFS download fails", async function () {
            mockIPFS.setFailure("download");

            const encryptedKeyHex = await fileRegistry.downloadFile(storedFileHash);
            const encryptedKeyBuffer = Buffer.from(
                encryptedKeyHex.startsWith("0x") ? encryptedKeyHex.slice(2) : encryptedKeyHex,
                "hex"
            );
            const keyData = JSON.parse(encryptedKeyBuffer.toString("utf8"));
            const symmetricKey = Buffer.from(keyData.key, "hex");

            // Should fail when downloading from IPFS
            const chunks = [];
            await expect(
                (async () => {
                    for await (const chunk of mockIPFS.cat(storedIPFSCID)) {
                        chunks.push(chunk);
                    }
                })()
            ).to.be.rejectedWith("Mock IPFS download failure");

            secureZero(symmetricKey);
        });

        it("Should fail when file does not exist on blockchain", async function () {
            const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

            await expect(
                fileRegistry.downloadFile(nonExistentHash)
            ).to.be.revertedWithCustomError(fileRegistry, "FileNotFound");
        });

        it("Should fail when IPFS CID is not found", async function () {
            const encryptedKeyHex = await fileRegistry.downloadFile(storedFileHash);
            const encryptedKeyBuffer = Buffer.from(
                encryptedKeyHex.startsWith("0x") ? encryptedKeyHex.slice(2) : encryptedKeyHex,
                "hex"
            );
            const keyData = JSON.parse(encryptedKeyBuffer.toString("utf8"));
            const symmetricKey = Buffer.from(keyData.key, "hex");

            // Try to download non-existent CID
            const fakeCID = "Qm" + "0".repeat(44);
            const chunks = [];
            await expect(
                (async () => {
                    for await (const chunk of mockIPFS.cat(fakeCID)) {
                        chunks.push(chunk);
                    }
                })()
            ).to.be.rejectedWith("Mock IPFS: File not found");

            secureZero(symmetricKey);
        });
    });

    describe("End-to-End File Transfer", function () {
        it("Should transfer file from sender to receiver (simulated)", async function () {
            // Simulate sender
            const senderData = generateDeterministicTestData(2048, "sender-file");
            const senderKey = generateSymmetricKey();
            const { ciphertext, iv, authTag } = encryptFile(senderData, senderKey);

            // Upload to IPFS
            const ipfsResult = await mockIPFS.add(ciphertext);
            const ipfsCID = ipfsResult.cid.toString();
            const fileHash = generateFileHash(ipfsCID);

            // Store on blockchain
            const keyMetadata = {
                iv,
                tag: authTag,
                key: senderKey.toString("hex")
            };
            const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

            await fileRegistry.connect(testAccount).uploadFile(
                fileHash,
                "0x" + encryptedKey.toString("hex")
            );

            // Simulate receiver
            const encryptedKeyHex = await fileRegistry.downloadFile(fileHash);
            const encryptedKeyBuffer = Buffer.from(
                encryptedKeyHex.startsWith("0x") ? encryptedKeyHex.slice(2) : encryptedKeyHex,
                "hex"
            );
            const keyData = JSON.parse(encryptedKeyBuffer.toString("utf8"));
            const receiverKey = Buffer.from(keyData.key, "hex");

            // Download from IPFS
            const chunks = [];
            for await (const chunk of mockIPFS.cat(ipfsCID)) {
                chunks.push(chunk);
            }
            const downloadedCiphertext = Buffer.concat(chunks);

            // Decrypt
            const decryptedData = decryptFile(
                downloadedCiphertext,
                receiverKey,
                keyData.iv,
                keyData.tag
            );

            // Verify
            expect(decryptedData).to.deep.equal(senderData);

            // Cleanup
            secureZero(senderKey);
            secureZero(receiverKey);
        });
    });

    describe("Extreme Edge Cases", function () {
        it("Should handle 1-byte file correctly", async function () {
            const testData = Buffer.from([0x42]);
            const symmetricKey = generateSymmetricKey();
            const { ciphertext, iv, authTag } = encryptFile(testData, symmetricKey);

            const ipfsResult = await mockIPFS.add(ciphertext);
            const ipfsCID = ipfsResult.cid.toString();
            const fileHash = generateFileHash(ipfsCID);

            const keyMetadata = {
                iv,
                tag: authTag,
                key: symmetricKey.toString("hex")
            };
            const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

            await fileRegistry.connect(testAccount).uploadFile(
                fileHash,
                "0x" + encryptedKey.toString("hex")
            );

            const chunks = [];
            for await (const chunk of mockIPFS.cat(ipfsCID)) {
                chunks.push(chunk);
            }
            const downloadedCiphertext = Buffer.concat(chunks);
            const decryptedData = decryptFile(downloadedCiphertext, symmetricKey, iv, authTag);

            expect(decryptedData).to.deep.equal(testData);
            expect(decryptedData.length).to.equal(1);
            expect(decryptedData[0]).to.equal(0x42);

            secureZero(symmetricKey);
        });

        it("Should handle large file near maximum size boundary", async function () {
            const LARGE_FILE_SIZE = 10 * 1024 * 1024;
            const testData = generateDeterministicTestData(LARGE_FILE_SIZE, "large-file");
            const symmetricKey = generateSymmetricKey();
            const { ciphertext, iv, authTag } = encryptFile(testData, symmetricKey);

            const ipfsResult = await mockIPFS.add(ciphertext);
            const ipfsCID = ipfsResult.cid.toString();
            const fileHash = generateFileHash(ipfsCID);

            const keyMetadata = {
                iv,
                tag: authTag,
                key: symmetricKey.toString("hex")
            };
            const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

            await fileRegistry.connect(testAccount).uploadFile(
                fileHash,
                "0x" + encryptedKey.toString("hex")
            );

            const chunks = [];
            for await (const chunk of mockIPFS.cat(ipfsCID)) {
                chunks.push(chunk);
            }
            const downloadedCiphertext = Buffer.concat(chunks);
            const decryptedData = decryptFile(downloadedCiphertext, symmetricKey, iv, authTag);

            expect(decryptedData.length).to.equal(LARGE_FILE_SIZE);
            expect(decryptedData).to.deep.equal(testData);

            secureZero(symmetricKey);
        });


        it("Should handle rapid interleaved uploads and downloads", async function () {
            const operations = [];
            const fileHashes = [];
            const symmetricKeys = [];

            for (let i = 0; i < 10; i++) {
                const testData = generateDeterministicTestData(100, `interleaved-${i}`);
                const symmetricKey = generateSymmetricKey();
                symmetricKeys.push({ key: symmetricKey, data: testData });
                const { ciphertext, iv, authTag } = encryptFile(testData, symmetricKey);

                const ipfsResult = await mockIPFS.add(ciphertext);
                const ipfsCID = ipfsResult.cid.toString();
                const fileHash = generateFileHash(ipfsCID);
                fileHashes.push({ fileHash, ipfsCID, iv, authTag });

                const keyMetadata = {
                    iv,
                    tag: authTag,
                    key: symmetricKey.toString("hex")
                };
                const encryptedKey = Buffer.from(JSON.stringify(keyMetadata));

                operations.push(
                    fileRegistry.connect(testAccount).uploadFile(
                        fileHash,
                        "0x" + encryptedKey.toString("hex")
                    )
                );
            }

            await Promise.all(operations);

            for (let i = 0; i < fileHashes.length; i++) {
                const { fileHash, ipfsCID, iv, authTag } = fileHashes[i];
                const { key, data } = symmetricKeys[i];

                const exists = await fileRegistry.fileExists(fileHash);
                expect(exists).to.be.true;

                const chunks = [];
                for await (const chunk of mockIPFS.cat(ipfsCID)) {
                    chunks.push(chunk);
                }
                const downloadedCiphertext = Buffer.concat(chunks);
                const decryptedData = decryptFile(downloadedCiphertext, key, iv, authTag);

                expect(decryptedData).to.deep.equal(data);
                secureZero(key);
            }
        });
    });

    describe("Error Handling and Edge Cases", function () {
        it("Should handle corrupted encrypted key data", async function () {
            const testData = generateDeterministicTestData(100, "corrupt-test");
            const symmetricKey = generateSymmetricKey();
            const { ciphertext } = encryptFile(testData, symmetricKey);

            const ipfsResult = await mockIPFS.add(ciphertext);
            const ipfsCID = ipfsResult.cid.toString();
            const fileHash = generateFileHash(ipfsCID);

            // Upload corrupted key data
            const corruptedKey = "not-valid-json";
            await fileRegistry.connect(testAccount).uploadFile(
                fileHash,
                "0x" + Buffer.from(corruptedKey).toString("hex")
            );

            // Download should succeed (contract doesn't validate key format)
            const encryptedKeyHex = await fileRegistry.downloadFile(fileHash);
            const encryptedKeyBuffer = Buffer.from(
                encryptedKeyHex.startsWith("0x") ? encryptedKeyHex.slice(2) : encryptedKeyHex,
                "hex"
            );

            // Parsing should fail
            expect(() => {
                JSON.parse(encryptedKeyBuffer.toString("utf8"));
            }).to.throw();

            secureZero(symmetricKey);
        });

        it("Should handle timeout scenarios", async function () {
            mockIPFS.setUploadDelay(50000); // 50 second delay

            const testData = generateDeterministicTestData(100, "timeout-test");
            const symmetricKey = generateSymmetricKey();
            const { ciphertext } = encryptFile(testData, symmetricKey);

            // Verify delay is set
            expect(mockIPFS.uploadDelay).to.equal(50000);

            // Test that operation would timeout with real timeout handler
            // Create a promise that races upload against a shorter timeout
            const shortTimeout = 100; // 100ms timeout
            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error("Operation timed out")), shortTimeout);
            });

            const uploadPromise = mockIPFS.add(ciphertext);

            // Should timeout before upload completes (50s delay > 100ms timeout)
            await expect(
                Promise.race([uploadPromise, timeoutPromise])
            ).to.be.rejectedWith("Operation timed out");

            secureZero(symmetricKey);
        });
    });
});
