/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Unit tests for validation utilities
 */

const { expect } = require("chai");
const {
    validateFileHash,
    validateIPFSHash,
    validateAddress,
    validatePrivateKey,
    validateEncryptedKey,
    validateFilePath,
    validateUploadParams,
    validateDownloadParams
} = require("../src/utils/validation");

describe("Validation Utilities", function () {
    describe("validateFileHash", function () {
        it("Should accept valid file hash", function () {
            const validHash = "0x" + "a".repeat(64);
            const result = validateFileHash(validHash);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validHash);
        });

        it("Should reject invalid file hash (wrong length)", function () {
            const invalidHash = "0x" + "a".repeat(63);
            const result = validateFileHash(invalidHash);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/File hash|32-byte|hex/i);
        });

        it("Should reject invalid file hash (missing 0x)", function () {
            const invalidHash = "a".repeat(64);
            const result = validateFileHash(invalidHash);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.include("0x");
        });

        it("Should reject invalid file hash (non-hex characters)", function () {
            const invalidHash = "0x" + "g".repeat(64);
            const result = validateFileHash(invalidHash);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/hex|invalid/i);
        });

        it("Should reject empty file hash", function () {
            const result = validateFileHash("");
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/required|empty|invalid/i);
        });
    });

    describe("validateIPFSHash", function () {
        it("Should accept valid IPFS CID v0", function () {
            const validCID = "Qm" + "a".repeat(44);
            const result = validateIPFSHash(validCID);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validCID);
        });

        it("Should accept valid IPFS CID v1", function () {
            const validCID = "b" + "a".repeat(58);
            const result = validateIPFSHash(validCID);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validCID);
        });

        it("Should reject invalid IPFS CID (wrong format)", function () {
            const invalidCID = "invalid-cid";
            const result = validateIPFSHash(invalidCID);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/IPFS|CID|format|invalid/i);
        });

        it("Should reject empty IPFS hash", function () {
            const result = validateIPFSHash("");
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/required|empty|invalid/i);
        });
    });

    describe("validateAddress", function () {
        it("Should accept valid Ethereum address", function () {
            const validAddress = "0x" + "a".repeat(40);
            const result = validateAddress(validAddress);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validAddress);
        });

        it("Should reject invalid address (wrong length)", function () {
            const invalidAddress = "0x" + "a".repeat(39);
            const result = validateAddress(invalidAddress);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/address|length|40/i);
        });

        it("Should reject invalid address (missing 0x)", function () {
            const invalidAddress = "a".repeat(40);
            const result = validateAddress(invalidAddress);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/Address|Ethereum/i);
        });

        it("Should reject invalid address (non-hex)", function () {
            const invalidAddress = "0x" + "g".repeat(40);
            const result = validateAddress(invalidAddress);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/Address|Ethereum/i);
        });
    });

    describe("validatePrivateKey", function () {
        it("Should accept valid private key", function () {
            const validKey = "0x" + "a".repeat(64);
            const result = validatePrivateKey(validKey);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validKey);
        });

        it("Should reject invalid private key (wrong length)", function () {
            const invalidKey = "0x" + "a".repeat(63);
            const result = validatePrivateKey(invalidKey);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/private.*key|length|64/i);
        });

        it("Should reject invalid private key (missing 0x)", function () {
            const invalidKey = "a".repeat(64);
            const result = validatePrivateKey(invalidKey);
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/Private key|32-byte/i);
        });
    });

    describe("validateEncryptedKey", function () {
        it("Should accept non-empty encrypted key", function () {
            const validKey = "some-encrypted-data";
            const result = validateEncryptedKey(validKey);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validKey);
        });

        it("Should reject empty encrypted key", function () {
            const result = validateEncryptedKey("");
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/required|empty/i);
        });
    });

    describe("validateFilePath", function () {
        it("Should accept valid file path", function () {
            const validPath = "/path/to/file.txt";
            const result = validateFilePath(validPath);
            expect(result.error).to.be.undefined;
            expect(result.value).to.equal(validPath);
        });

        it("Should reject empty file path", function () {
            const result = validateFilePath("");
            expect(result.error).to.not.be.undefined;
            expect(result.error.message).to.match(/required|empty|path/i);
        });
    });

    describe("validateUploadParams", function () {
        it("Should accept valid upload parameters", function () {
            const validParams = {
                filePath: "/path/to/file.txt",
                privateKey: "0x" + "a".repeat(64),
                contractAddress: "0x" + "b".repeat(40)
            };
            const result = validateUploadParams(validParams);
            expect(result.error).to.be.undefined;
            expect(result.value).to.deep.equal(validParams);
        });

        it("Should reject missing filePath", function () {
            const invalidParams = {
                privateKey: "0x" + "a".repeat(64),
                contractAddress: "0x" + "b".repeat(40)
            };
            const result = validateUploadParams(invalidParams);
            expect(result.error).to.not.be.undefined;
        });

        it("Should reject invalid privateKey", function () {
            const invalidParams = {
                filePath: "/path/to/file.txt",
                privateKey: "invalid",
                contractAddress: "0x" + "b".repeat(40)
            };
            const result = validateUploadParams(invalidParams);
            expect(result.error).to.not.be.undefined;
        });

        it("Should reject invalid contractAddress", function () {
            const invalidParams = {
                filePath: "/path/to/file.txt",
                privateKey: "0x" + "a".repeat(64),
                contractAddress: "invalid"
            };
            const result = validateUploadParams(invalidParams);
            expect(result.error).to.not.be.undefined;
        });
    });

    describe("validateDownloadParams", function () {
        it("Should accept valid download parameters", function () {
            const validParams = {
                fileHash: "0x" + "a".repeat(64),
                contractAddress: "0x" + "b".repeat(40),
                outputPath: "/path/to/output.txt"
            };
            const result = validateDownloadParams(validParams);
            expect(result.error).to.be.undefined;
            expect(result.value).to.deep.equal(validParams);
        });

        it("Should reject missing fileHash", function () {
            const invalidParams = {
                contractAddress: "0x" + "b".repeat(40),
                outputPath: "/path/to/output.txt"
            };
            const result = validateDownloadParams(invalidParams);
            expect(result.error).to.not.be.undefined;
        });

        it("Should reject invalid fileHash", function () {
            const invalidParams = {
                fileHash: "invalid",
                contractAddress: "0x" + "b".repeat(40),
                outputPath: "/path/to/output.txt"
            };
            const result = validateDownloadParams(invalidParams);
            expect(result.error).to.not.be.undefined;
        });
    });
});

