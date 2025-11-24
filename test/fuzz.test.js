/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Fuzz and property-style tests for DecentraFile
 * Tests with random inputs to find edge cases and bugs
 *
 * Run with: npm run test:fuzz
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require("crypto");
const {
    generateSymmetricKey,
    encryptFile,
    decryptFile,
    secureZero,
    AES_KEY_SIZE
} = require("../src/crypto/crypto");
const {
    generateFileHash,
    generateTestData
} = require("./utils/test-helpers");

describe("DecentraFile Fuzz Tests", function () {
    this.timeout(60000); // Longer timeout for fuzz tests

    describe("Crypto Module Fuzz Tests", function () {
        it("Should encrypt and decrypt random data correctly (property test)", function () {
            const iterations = 50;
            const maxSize = 10 * 1024; // 10KB max for fuzz test

            for (let i = 0; i < iterations; i++) {
                // Generate random size between 1 byte and maxSize
                const size = Math.floor(Math.random() * maxSize) + 1;
                const plaintext = generateTestData(size);
                const key = generateSymmetricKey();

                // Encrypt
                const { ciphertext, iv, authTag } = encryptFile(plaintext, key);

                // Verify encryption properties
                expect(ciphertext).to.be.instanceOf(Buffer);
                expect(ciphertext.length).to.be.greaterThan(0);
                expect(iv).to.be.a("string");
                expect(iv.length).to.equal(32); // 16 bytes * 2 (hex)
                expect(authTag).to.be.a("string");
                expect(authTag.length).to.equal(32); // 16 bytes * 2 (hex)

                // Decrypt
                const decrypted = decryptFile(ciphertext, key, iv, authTag);

                // Property: encrypt-then-decrypt equals original
                expect(decrypted).to.deep.equal(plaintext);

                // Cleanup
                secureZero(key);
            }
        });

        it("Should fail decryption with random wrong keys", function () {
            const iterations = 20;

            for (let i = 0; i < iterations; i++) {
                const plaintext = generateTestData(100 + Math.floor(Math.random() * 900));
                const correctKey = generateSymmetricKey();
                const wrongKey = generateSymmetricKey();

                const { ciphertext, iv, authTag } = encryptFile(plaintext, correctKey);

                // Should fail with wrong key
                expect(() => {
                    decryptFile(ciphertext, wrongKey, iv, authTag);
                }).to.throw("Decryption failed");

                secureZero(correctKey);
                secureZero(wrongKey);
            }
        });

        it("Should handle random IV corruption", function () {
            const iterations = 20;

            for (let i = 0; i < iterations; i++) {
                const plaintext = generateTestData(100);
                const key = generateSymmetricKey();
                const { ciphertext, iv, authTag } = encryptFile(plaintext, key);

                // Corrupt IV randomly
                const corruptedIV = crypto.randomBytes(16).toString("hex");

                expect(() => {
                    decryptFile(ciphertext, key, corruptedIV, authTag);
                }).to.throw("Decryption failed");

                secureZero(key);
            }
        });

        it("Should handle random auth tag corruption", function () {
            const iterations = 20;

            for (let i = 0; i < iterations; i++) {
                const plaintext = generateTestData(100);
                const key = generateSymmetricKey();
                const { ciphertext, iv, authTag } = encryptFile(plaintext, key);

                // Corrupt auth tag randomly
                const corruptedTag = crypto.randomBytes(16).toString("hex");

                expect(() => {
                    decryptFile(ciphertext, key, iv, corruptedTag);
                }).to.throw("Decryption failed");

                secureZero(key);
            }
        });

        it("Should handle random ciphertext corruption", function () {
            const iterations = 20;

            for (let i = 0; i < iterations; i++) {
                const plaintext = generateTestData(100);
                const key = generateSymmetricKey();
                const { ciphertext, iv, authTag } = encryptFile(plaintext, key);

                // Corrupt ciphertext randomly
                const corruptedCiphertext = Buffer.from(ciphertext);
                const randomIndex = Math.floor(Math.random() * corruptedCiphertext.length);
                corruptedCiphertext[randomIndex] = corruptedCiphertext[randomIndex] ^ 0xff;

                expect(() => {
                    decryptFile(corruptedCiphertext, key, iv, authTag);
                }).to.throw("Decryption failed");

                secureZero(key);
            }
        });
    });

    describe("Contract Fuzz Tests", function () {
        let fileRegistry;
        let testAccount;

        beforeEach(async function () {
            const [owner] = await ethers.getSigners();
            const FileRegistry = await ethers.getContractFactory("FileRegistry");
            fileRegistry = await FileRegistry.deploy();
            await fileRegistry.waitForDeployment();
            testAccount = owner;
        });

        it("Should handle random valid fileHash and encryptedKey combinations", async function () {
            const iterations = 30;

            for (let i = 0; i < iterations; i++) {
                // Generate random fileHash (valid bytes32)
                const randomBytes = crypto.randomBytes(32);
                const fileHash = "0x" + randomBytes.toString("hex");

                // Generate random encrypted key (within limits)
                const keySize = Math.floor(Math.random() * 500) + 1; // 1-500 bytes
                const encryptedKey = "0x" + crypto.randomBytes(keySize).toString("hex");

                // Should upload successfully
                await fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey);

                // Verify it exists
                expect(await fileRegistry.fileExists(fileHash)).to.be.true;

                // Verify we can download it
                const downloaded = await fileRegistry.downloadFile(fileHash);
                expect(downloaded).to.equal(encryptedKey);
            }
        });

        it("Should reject random invalid fileHash values", async function () {
            const iterations = 20;

            for (let i = 0; i < iterations; i++) {
                // Test zero hash (invalid)
                const zeroHash = ethers.ZeroHash;
                const encryptedKey = "0x" + crypto.randomBytes(100).toString("hex");

                await expect(
                    fileRegistry.connect(testAccount).uploadFile(zeroHash, encryptedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "InvalidFileHash");
            }
        });

        it("Should handle boundary conditions for encrypted key size", async function () {
            // Test at boundaries: 1 byte, 1023 bytes, 1024 bytes, 1025 bytes
            const boundaries = [1, 1023, 1024, 1025];

            for (const size of boundaries) {
                // Generate unique fileHash for each test
                const randomBytes = crypto.randomBytes(32);
                const fileHash = "0x" + randomBytes.toString("hex");
                const encryptedKey = "0x" + crypto.randomBytes(size).toString("hex");

                if (size === 0) {
                    await expect(
                        fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey)
                    ).to.be.revertedWithCustomError(fileRegistry, "InvalidEncryptedKey");
                } else if (size > 1024) {
                    await expect(
                        fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey)
                    ).to.be.revertedWithCustomError(fileRegistry, "EncryptedKeyTooLarge");
                } else {
                    // Should succeed
                    await fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey);
                    expect(await fileRegistry.fileExists(fileHash)).to.be.true;
                }
            }
        });

        it("Should maintain invariants under random operations", async function () {
            const iterations = 20;
            const uploadedFiles = new Set();

            for (let i = 0; i < iterations; i++) {
                const randomBytes = crypto.randomBytes(32);
                const fileHash = "0x" + randomBytes.toString("hex");
                const encryptedKey = "0x" + crypto.randomBytes(100).toString("hex");

                if (!uploadedFiles.has(fileHash)) {
                    await fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey);
                    uploadedFiles.add(fileHash);

                    // Invariant: File should exist after upload
                    expect(await fileRegistry.fileExists(fileHash)).to.be.true;

                    // Invariant: Owner should be testAccount
                    const metadata = await fileRegistry.getFileMetadata(fileHash);
                    expect(metadata.owner).to.equal(testAccount.address);

                    // Invariant: Timestamp should be set
                    expect(metadata.timestamp).to.be.gt(0);

                    // Invariant: Downloaded key should match uploaded key
                    const downloaded = await fileRegistry.downloadFile(fileHash);
                    expect(downloaded).to.equal(encryptedKey);
                } else {
                    // Invariant: Cannot upload same fileHash twice
                    await expect(
                        fileRegistry.connect(testAccount).uploadFile(fileHash, encryptedKey)
                    ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");
                }
            }

            // Invariant: User file count should match uploaded files
            const userFileCount = await fileRegistry.getUserFileCount(testAccount.address);
            expect(userFileCount).to.equal(uploadedFiles.size);
        });
    });

    describe("Property Tests", function () {
        it("Should maintain encryption property: encrypt(decrypt(c, k), k) = c", function () {
            const iterations = 30;

            for (let i = 0; i < iterations; i++) {
                const plaintext = generateTestData(Math.floor(Math.random() * 1000) + 1);
                const key = generateSymmetricKey();

                const { ciphertext, iv, authTag } = encryptFile(plaintext, key);
                const decrypted = decryptFile(ciphertext, key, iv, authTag);

                // Property: decryption of encryption equals original
                expect(decrypted).to.deep.equal(plaintext);

                secureZero(key);
            }
        });

        it("Should generate unique IVs for same plaintext (non-deterministic encryption)", function () {
            const plaintext = generateTestData(100);
            const key = generateSymmetricKey();
            const ivs = new Set();

            for (let i = 0; i < 50; i++) {
                const { iv } = encryptFile(plaintext, key);
                expect(ivs.has(iv)).to.be.false;
                ivs.add(iv);
            }

            secureZero(key);
        });

        it("Should generate unique ciphertexts for same plaintext (semantic security)", function () {
            const plaintext = generateTestData(100);
            const key = generateSymmetricKey();
            const ciphertexts = new Set();

            for (let i = 0; i < 50; i++) {
                const { ciphertext } = encryptFile(plaintext, key);
                const ciphertextHex = ciphertext.toString("hex");
                expect(ciphertexts.has(ciphertextHex)).to.be.false;
                ciphertexts.add(ciphertextHex);
            }

            secureZero(key);
        });
    });
});

