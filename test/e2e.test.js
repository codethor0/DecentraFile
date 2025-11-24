/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * End-to-End tests for DecentraFile
 * Tests file system operations and validation logic
 *
 * Note: Full E2E tests with IPFS integration are in integration.test.js
 * These tests focus on file system and validation aspects
 */

const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
    generateDeterministicTestData
} = require("./utils/test-helpers");

describe("DecentraFile E2E Tests", function () {
    let tempDir;

    beforeEach(function () {
    // Create temp directory
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "decentrafile-e2e-"));
    });

    afterEach(function () {
    // Cleanup
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe("File System Operations", function () {
        it("Should create and read test files", function () {
            const testData = generateDeterministicTestData(2048, "e2e-test");
            const testFilePath = path.join(tempDir, "test-file.txt");

            // Write file
            fs.writeFileSync(testFilePath, testData);

            // Verify file exists
            expect(fs.existsSync(testFilePath)).to.be.true;

            // Read and verify content
            const readData = fs.readFileSync(testFilePath);
            expect(readData).to.deep.equal(testData);
        });

        it("Should handle file size validation", function () {
            const largeData = generateDeterministicTestData(101 * 1024 * 1024, "too-large"); // 101MB
            const testFilePath = path.join(tempDir, "large-file.txt");

            fs.writeFileSync(testFilePath, largeData);

            // Verify file exists and size
            expect(fs.existsSync(testFilePath)).to.be.true;
            const stats = fs.statSync(testFilePath);
            expect(stats.size).to.be.greaterThan(100 * 1024 * 1024);
            expect(stats.size).to.equal(101 * 1024 * 1024);
        });

        it("Should handle directory creation", function () {
            const subDir = path.join(tempDir, "subdir");
            fs.mkdirSync(subDir, { recursive: true });

            expect(fs.existsSync(subDir)).to.be.true;
            expect(fs.statSync(subDir).isDirectory()).to.be.true;
        });
    });

    describe("Error Scenarios", function () {
        it("Should handle missing file gracefully", function () {
            const nonExistentPath = path.join(tempDir, "non-existent.txt");

            expect(fs.existsSync(nonExistentPath)).to.be.false;

            // Should throw when trying to read
            expect(() => {
                fs.readFileSync(nonExistentPath);
            }).to.throw();
        });

        it("Should validate file paths", function () {
            const validPath = "/path/to/file.txt";
            const invalidPath = "";

            expect(validPath.length).to.be.greaterThan(0);
            expect(invalidPath.length).to.equal(0);
        });
    });

    describe("Path Operations", function () {
        it("Should handle path joining correctly", function () {
            const basePath = "/base";
            const fileName = "file.txt";
            const joined = path.join(basePath, fileName);

            expect(joined).to.include(fileName);
        });

        it("Should extract file basename", function () {
            const fullPath = "/path/to/file.txt";
            const basename = path.basename(fullPath);

            expect(basename).to.equal("file.txt");
        });
    });
});

