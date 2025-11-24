/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const { expect } = require("chai");
const {
    generateSymmetricKey,
    encryptFile,
    decryptFile,
    wrapKeyForRecipient,
    unwrapKeyForRecipient,
    secureZero,
    AES_KEY_SIZE,
    AES_IV_SIZE,
    MAX_ENCRYPTED_KEY_SIZE
} = require("../src/crypto/crypto");
const crypto = require("crypto");

describe("Crypto Module", function () {
    describe("generateSymmetricKey", function () {
        it("Should generate a 32-byte key", function () {
            const key = generateSymmetricKey();
            expect(key).to.be.instanceOf(Buffer);
            expect(key.length).to.equal(AES_KEY_SIZE);
        });

        it("Should generate different keys on each call", function () {
            const key1 = generateSymmetricKey();
            const key2 = generateSymmetricKey();
            expect(key1.toString("hex")).to.not.equal(key2.toString("hex"));
        });

        it("Should generate cryptographically random keys", function () {
            const keys = new Set();
            for (let i = 0; i < 100; i++) {
                const key = generateSymmetricKey();
                const keyHex = key.toString("hex");
                expect(keys.has(keyHex)).to.be.false;
                keys.add(keyHex);
            }
        });
    });

    describe("encryptFile and decryptFile", function () {
        it("Should encrypt and decrypt file successfully", function () {
            const originalData = Buffer.from("Hello, DecentraFile! This is a test file.");
            const key = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(originalData, key);
            expect(ciphertext).to.be.instanceOf(Buffer);
            expect(ciphertext).to.not.deep.equal(originalData);
            expect(iv).to.be.a("string");
            expect(authTag).to.be.a("string");
            expect(iv.length).to.equal(AES_IV_SIZE * 2); // Hex encoding doubles length
            expect(authTag.length).to.be.greaterThan(0);

            const decrypted = decryptFile(ciphertext, key, iv, authTag);
            expect(decrypted).to.deep.equal(originalData);
        });

        it("Should fail decryption with wrong key", function () {
            const originalData = Buffer.from("Test data");
            const key1 = generateSymmetricKey();
            const key2 = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(originalData, key1);

            expect(() => {
                decryptFile(ciphertext, key2, iv, authTag);
            }).to.throw("Decryption failed");
        });

        it("Should fail decryption with wrong IV", function () {
            const originalData = Buffer.from("Test data");
            const key = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(originalData, key);
            const wrongIV = generateSymmetricKey().toString("hex").substring(0, AES_IV_SIZE * 2);

            expect(() => {
                decryptFile(ciphertext, key, wrongIV, authTag);
            }).to.throw("Decryption failed");
        });

        it("Should fail decryption with wrong auth tag", function () {
            const originalData = Buffer.from("Test data");
            const key = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(originalData, key);
            const wrongTag = generateSymmetricKey().toString("hex").substring(0, 32);

            expect(() => {
                decryptFile(ciphertext, key, iv, wrongTag);
            }).to.throw("Decryption failed");
        });

        it("Should reject auth tag with incorrect length", function () {
            const originalData = Buffer.from("Test data");
            const key = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(originalData, key);

            // Test with too short auth tag
            const shortTag = authTag.substring(0, 16);
            expect(() => {
                decryptFile(ciphertext, key, iv, shortTag);
            }).to.throw("Auth tag must be");

            // Test with too long auth tag
            const longTag = authTag + "00";
            expect(() => {
                decryptFile(ciphertext, key, iv, longTag);
            }).to.throw("Auth tag must be");
        });

        it("Should reject IV with incorrect length", function () {
            const originalData = Buffer.from("Test data");
            const key = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(originalData, key);

            // Test with too short IV
            const shortIV = iv.substring(0, 16);
            expect(() => {
                decryptFile(ciphertext, key, shortIV, authTag);
            }).to.throw("IV must be");

            // Test with too long IV
            const longIV = iv + "00";
            expect(() => {
                decryptFile(ciphertext, key, longIV, authTag);
            }).to.throw("IV must be");
        });

        it("Should generate unique IVs for each encryption", function () {
            const data = Buffer.from("Test data");
            const key = generateSymmetricKey();
            const ivs = new Set();

            for (let i = 0; i < 100; i++) {
                const { iv } = encryptFile(data, key);
                expect(ivs.has(iv)).to.be.false;
                ivs.add(iv);
            }
        });

        it("Should handle empty file (should fail)", function () {
            const emptyData = Buffer.from("");
            const key = generateSymmetricKey();

            expect(() => {
                encryptFile(emptyData, key);
            }).to.throw("Cannot encrypt empty file");
        });

        it("Should handle large files", function () {
            const largeData = Buffer.alloc(10 * 1024 * 1024, "x"); // 10MB
            const key = generateSymmetricKey();

            const { ciphertext, iv, authTag } = encryptFile(largeData, key);
            const decrypted = decryptFile(ciphertext, key, iv, authTag);
            expect(decrypted).to.deep.equal(largeData);
        });

        it("Should reject invalid key length", function () {
            const data = Buffer.from("Test data");
            const wrongKey = Buffer.alloc(16); // Wrong size

            expect(() => {
                encryptFile(data, wrongKey);
            }).to.throw("Symmetric key must be a 32-byte Buffer");
        });

        it("Should reject non-Buffer input", function () {
            const key = generateSymmetricKey();

            expect(() => {
                encryptFile("not a buffer", key);
            }).to.throw("File buffer must be a Buffer");
        });
    });

    describe("wrapKeyForRecipient and unwrapKeyForRecipient", function () {
        let publicKey;
        let privateKey;

        before(function () {
            // Generate RSA key pair for testing
            const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync("rsa", {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: "spki",
                    format: "pem"
                },
                privateKeyEncoding: {
                    type: "pkcs8",
                    format: "pem"
                }
            });
            publicKey = pub;
            privateKey = priv;
        });

        it("Should wrap and unwrap symmetric key successfully", function () {
            const symmetricKey = generateSymmetricKey();
            const wrappedKey = wrapKeyForRecipient(symmetricKey, publicKey);

            expect(wrappedKey).to.be.instanceOf(Buffer);
            expect(wrappedKey.length).to.be.lessThanOrEqual(MAX_ENCRYPTED_KEY_SIZE);

            const unwrappedKey = unwrapKeyForRecipient(wrappedKey, privateKey);
            expect(unwrappedKey).to.deep.equal(symmetricKey);
            expect(unwrappedKey.length).to.equal(AES_KEY_SIZE);
        });

        it("Should fail unwrapping with wrong private key", function () {
            const symmetricKey = generateSymmetricKey();
            const wrappedKey = wrapKeyForRecipient(symmetricKey, publicKey);

            // Generate different key pair
            const { privateKey: wrongPrivateKey } = crypto.generateKeyPairSync("rsa", {
                modulusLength: 2048,
                privateKeyEncoding: {
                    type: "pkcs8",
                    format: "pem"
                }
            });

            expect(() => {
                unwrapKeyForRecipient(wrappedKey, wrongPrivateKey);
            }).to.throw("Key unwrapping failed");
        });

        it("Should reject invalid symmetric key length", function () {
            const wrongKey = Buffer.alloc(16);

            expect(() => {
                wrapKeyForRecipient(wrongKey, publicKey);
            }).to.throw("Symmetric key must be a 32-byte Buffer");
        });

        it("Should reject invalid public key format", function () {
            const symmetricKey = generateSymmetricKey();

            expect(() => {
                wrapKeyForRecipient(symmetricKey, "not a pem key");
            }).to.throw("Recipient public key must be in PEM format");
        });

        it("Should reject invalid private key format", function () {
            const symmetricKey = generateSymmetricKey();
            const wrappedKey = wrapKeyForRecipient(symmetricKey, publicKey);

            expect(() => {
                unwrapKeyForRecipient(wrappedKey, "not a pem key");
            }).to.throw("Recipient private key must be in PEM format");
        });
    });

    describe("secureZero", function () {
        it("Should zero out buffer", function () {
            const buffer = Buffer.from("sensitive data");
            secureZero(buffer);
            expect(buffer.toString()).to.equal("\x00".repeat(buffer.length));
        });

        it("Should handle non-Buffer input gracefully", function () {
            expect(() => {
                secureZero("not a buffer");
            }).to.not.throw();
        });
    });

    describe("Constants", function () {
        it("Should export correct constants", function () {
            expect(AES_KEY_SIZE).to.equal(32);
            expect(AES_IV_SIZE).to.equal(16);
            expect(MAX_ENCRYPTED_KEY_SIZE).to.equal(1024);
        });
    });
});

