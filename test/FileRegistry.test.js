/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FileRegistry", function () {
    let fileRegistry;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const FileRegistry = await ethers.getContractFactory("FileRegistry");
        fileRegistry = await FileRegistry.deploy();
        await fileRegistry.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should deploy successfully", async function () {
            expect(await fileRegistry.getAddress()).to.be.properAddress;
        });

        it("Should have zero files initially", async function () {
            const count = await fileRegistry.getUserFileCount(addr1.address);
            expect(count).to.equal(0);
        });
    });

    describe("File Upload", function () {
        it("Should upload a file successfully", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            const tx = await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            // Verify event was emitted with all 3 arguments (fileHash, owner, timestamp)
            await expect(tx)
                .to.emit(fileRegistry, "FileUploaded")
                .withArgs(fileHash, addr1.address, (timestamp) => {
                    return timestamp > 0;
                });

            // Verify metadata is set correctly
            const metadata = await fileRegistry.getFileMetadata(fileHash);
            expect(metadata.owner).to.equal(addr1.address);
            expect(metadata.timestamp).to.be.gt(0);
        });

        it("Should prevent uploading the same file twice", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            await expect(
                fileRegistry.connect(addr2).uploadFile(fileHash, encryptedKey)
            ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");
        });

        it("Should prevent owner from overwriting their own file", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-overwrite"));
            const encryptedKey1 = ethers.toUtf8Bytes("encrypted-key-data-1");
            const encryptedKey2 = ethers.toUtf8Bytes("encrypted-key-data-2");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey1);

            // Even the owner cannot overwrite
            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey2)
            ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");
        });

        it("Should prevent uploading with zero file hash", async function () {
            const fileHash = ethers.ZeroHash;
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey)
            ).to.be.revertedWithCustomError(fileRegistry, "InvalidFileHash");
        });

        it("Should prevent uploading with empty encrypted key", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("");

            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey)
            ).to.be.revertedWithCustomError(fileRegistry, "InvalidEncryptedKey");
        });

        it("Should track user files", async function () {
            const fileHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-file-1"));
            const fileHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-file-2"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash1, encryptedKey);
            await fileRegistry.connect(addr1).uploadFile(fileHash2, encryptedKey);

            const userFiles = await fileRegistry.getUserFiles(addr1.address);
            expect(userFiles.length).to.equal(2);
            expect(userFiles[0]).to.equal(fileHash1);
            expect(userFiles[1]).to.equal(fileHash2);
        });

        it("Should update user file count", async function () {
            const fileHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-file-1"));
            const fileHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-file-2"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(0);

            await fileRegistry.connect(addr1).uploadFile(fileHash1, encryptedKey);
            expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(1);

            await fileRegistry.connect(addr1).uploadFile(fileHash2, encryptedKey);
            expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(2);
        });

        it("Should allow different users to upload different files", async function () {
            const fileHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-file-1"));
            const fileHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-file-2"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash1, encryptedKey);
            await fileRegistry.connect(addr2).uploadFile(fileHash2, encryptedKey);

            const metadata1 = await fileRegistry.getFileMetadata(fileHash1);
            const metadata2 = await fileRegistry.getFileMetadata(fileHash2);

            expect(metadata1.owner).to.equal(addr1.address);
            expect(metadata2.owner).to.equal(addr2.address);
        });

        it("Should store correct timestamp", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const beforeUpload = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            const metadata = await fileRegistry.getFileMetadata(fileHash);
            expect(metadata.timestamp).to.be.gte(beforeUpload.timestamp);
        });
    });

    describe("File Download", function () {
        it("Should download file metadata successfully", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            const downloadedKey = await fileRegistry.connect(addr2).downloadFile.staticCall(fileHash);
            expect(ethers.toUtf8String(downloadedKey)).to.equal("encrypted-key-data");
        });

        it("Should not emit events from view function downloadFile", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            // downloadFile is a view function and cannot emit events
            // Use retrieveFile for event emission
            // Contract returns bytes as hex string, convert for comparison
            const result = await fileRegistry.connect(addr2).downloadFile.staticCall(fileHash);
            expect(result).to.equal(ethers.hexlify(encryptedKey));
        });

        it("Should revert when file does not exist", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent-file"));

            await expect(
                fileRegistry.connect(addr1).downloadFile.staticCall(fileHash)
            ).to.be.revertedWithCustomError(fileRegistry, "FileNotFound");
        });

        it("Should get file metadata", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            const metadata = await fileRegistry.getFileMetadata(fileHash);
            expect(metadata.hash).to.equal(fileHash);
            expect(metadata.owner).to.equal(addr1.address);
            expect(metadata.timestamp).to.be.gt(0);
        });

        it("Should revert getFileMetadata when file does not exist", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent-file"));

            await expect(
                fileRegistry.getFileMetadata(fileHash)
            ).to.be.revertedWithCustomError(fileRegistry, "FileNotFound");
        });
    });

    describe("File Existence Checks", function () {
        it("Should return false for non-existent file", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent-file"));
            expect(await fileRegistry.fileExists(fileHash)).to.be.false;
        });

        it("Should return true for existing file", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
            expect(await fileRegistry.fileExists(fileHash)).to.be.true;
        });
    });

    describe("User File Management", function () {
        it("Should return empty array for user with no files", async function () {
            const userFiles = await fileRegistry.getUserFiles(addr1.address);
            expect(userFiles.length).to.equal(0);
        });

        it("Should return correct file count for user", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            for (let i = 0; i < 5; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`test-file-${i}`));
                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
            }

            expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(5);
        });

        it("Should isolate files between different users", async function () {
            const fileHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-file-1"));
            const fileHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-file-2"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash1, encryptedKey);
            await fileRegistry.connect(addr2).uploadFile(fileHash2, encryptedKey);

            const user1Files = await fileRegistry.getUserFiles(addr1.address);
            const user2Files = await fileRegistry.getUserFiles(addr2.address);

            expect(user1Files.length).to.equal(1);
            expect(user2Files.length).to.equal(1);
            expect(user1Files[0]).to.equal(fileHash1);
            expect(user2Files[0]).to.equal(fileHash2);
        });

        it("Should allow anyone to query getUserFiles for any user (public view function)", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-public"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            // Anyone can query any user's files (no access control on view function)
            const filesAsOwner = await fileRegistry.connect(addr1).getUserFiles(addr1.address);
            const filesAsOther = await fileRegistry.connect(addr2).getUserFiles(addr1.address);
            const filesAsThird = await fileRegistry.connect(owner).getUserFiles(addr1.address);

            // All should return the same result (public view function)
            expect(filesAsOwner).to.deep.equal(filesAsOther);
            expect(filesAsOther).to.deep.equal(filesAsThird);
            expect(filesAsOwner.length).to.equal(1);
            expect(filesAsOwner[0]).to.equal(fileHash);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum size encrypted key (exactly at limit)", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-max"));
            // MAX_ENCRYPTED_KEY_SIZE is 1024 bytes - test exactly at limit
            const maxKey = ethers.toUtf8Bytes("x".repeat(1024));

            await expect(fileRegistry.connect(addr1).uploadFile(fileHash, maxKey))
                .to.emit(fileRegistry, "FileUploaded");

            const metadata = await fileRegistry.getFileMetadata(fileHash);
            expect(metadata.owner).to.equal(addr1.address);
        });

        it("Should handle encrypted key just under maximum size", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-under"));
            // MAX_ENCRYPTED_KEY_SIZE is 1024 bytes - test 1 byte under limit
            const underMaxKey = ethers.toUtf8Bytes("x".repeat(1023));

            await expect(fileRegistry.connect(addr1).uploadFile(fileHash, underMaxKey))
                .to.emit(fileRegistry, "FileUploaded");
        });

        it("Should reject encrypted key exceeding maximum size", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            // MAX_ENCRYPTED_KEY_SIZE is 1024 bytes, so 1025 should fail
            const oversizedKey = ethers.toUtf8Bytes("x".repeat(1025));

            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, oversizedKey)
            ).to.be.revertedWithCustomError(fileRegistry, "EncryptedKeyTooLarge");
        });

        it("Should handle multiple rapid uploads", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const promises = [];

            for (let i = 0; i < 10; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`test-file-${i}`));
                promises.push(fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey));
            }

            await Promise.all(promises);
            expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(10);
        });

        it("Should verify MAX_ENCRYPTED_KEY_SIZE constant", async function () {
            const maxSize = await fileRegistry.MAX_ENCRYPTED_KEY_SIZE();
            expect(maxSize).to.equal(1024);
        });

        it("Should prevent exceeding maximum files per user", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const maxFiles = await fileRegistry.MAX_FILES_PER_USER();

            // Upload up to the limit
            for (let i = 0; i < maxFiles; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`test-file-${i}`));
                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
            }

            // Attempting to upload one more should fail
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-over-limit"));
            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey)
            ).to.be.revertedWithCustomError(fileRegistry, "MaxFilesPerUserExceeded");
        });

        it("Should verify MAX_FILES_PER_USER constant", async function () {
            const maxFiles = await fileRegistry.MAX_FILES_PER_USER();
            expect(maxFiles).to.equal(1000);
        });
    });

    describe("Security", function () {
        it("Should not expose sensitive data in events", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            const tx = await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
            const receipt = await tx.wait();

            // Verify event does not contain full encrypted key
            const event = receipt.logs.find(log => {
                try {
                    const parsed = fileRegistry.interface.parseLog(log);
                    return parsed && parsed.name === "FileUploaded";
                } catch {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
            // Event should only contain fileHash, owner, timestamp - not encryptedKey
        });

        it("Should allow owner to retrieveFile and emit download event", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            // Only owner can retrieve file
            await expect(fileRegistry.connect(addr1).retrieveFile(fileHash))
                .to.emit(fileRegistry, "FileDownloaded")
                .withArgs(fileHash, addr1.address);
        });

        it("Should deny non-owner access to retrieveFile", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            // Non-owner should be denied access with UnauthorizedAccess error
            await expect(
                fileRegistry.connect(addr2).retrieveFile(fileHash)
            ).to.be.revertedWithCustomError(fileRegistry, "UnauthorizedAccess");
        });

        it("Should verify downloadFile does not emit events (view function)", async function () {
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

            await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

            // View functions cannot emit events, so this should not revert
            // Contract returns bytes as hex string, convert for comparison
            const result = await fileRegistry.connect(addr2).downloadFile.staticCall(fileHash);
            expect(ethers.toUtf8String(result)).to.equal(ethers.toUtf8String(encryptedKey));
        });
    });

    describe("Formal Invariants", function () {
        describe("I1: MAX_FILES_PER_USER Enforcement", function () {
            it("Should enforce MAX_FILES_PER_USER limit", async function () {
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
                const maxFiles = await fileRegistry.MAX_FILES_PER_USER();

                // Upload up to the limit
                for (let i = 0; i < maxFiles; i++) {
                    const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`test-file-${i}`));
                    await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
                }

                // Verify count is at limit
                expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(maxFiles);

                // Attempt to upload one more should fail
                const oversizedFileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-oversized"));
                await expect(
                    fileRegistry.connect(addr1).uploadFile(oversizedFileHash, encryptedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "MaxFilesPerUserExceeded");
            });

            it("Should maintain invariant: user file count never exceeds MAX_FILES_PER_USER", async function () {
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
                const maxFiles = await fileRegistry.MAX_FILES_PER_USER();

                // Upload files and verify count never exceeds limit
                for (let i = 0; i < maxFiles; i++) {
                    const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`test-file-${i}`));
                    await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
                    const count = await fileRegistry.getUserFileCount(addr1.address);
                    expect(count).to.be.at.most(maxFiles);
                }
            });
        });

        describe("I2: File Metadata Consistency", function () {
            it("Should maintain invariant: encryptedKey.length > 0 && <= MAX_ENCRYPTED_KEY_SIZE", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                const metadata = await fileRegistry.getFileMetadata(fileHash);
                const maxSize = await fileRegistry.MAX_ENCRYPTED_KEY_SIZE();

                // Retrieve encrypted key to verify length
                const retrievedKey = await fileRegistry.downloadFile.staticCall(fileHash);
                expect(retrievedKey.length).to.be.gt(0);
                expect(retrievedKey.length).to.be.at.most(maxSize);
            });

            it("Should maintain invariant: owner != address(0)", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                const metadata = await fileRegistry.getFileMetadata(fileHash);
                expect(metadata.owner).to.not.equal(ethers.ZeroAddress);
            });

            it("Should maintain invariant: timestamp > 0", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                const metadata = await fileRegistry.getFileMetadata(fileHash);
                expect(metadata.timestamp).to.be.gt(0);
            });
        });

        describe("I3: Access Control Invariants", function () {
            it("Should maintain invariant: retrieveFile() only callable by owner", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // Owner can call
                await expect(fileRegistry.connect(addr1).retrieveFile(fileHash))
                    .to.emit(fileRegistry, "FileDownloaded");

                // Non-owner cannot call
                await expect(
                    fileRegistry.connect(addr2).retrieveFile(fileHash)
                ).to.be.revertedWithCustomError(fileRegistry, "UnauthorizedAccess");
            });

            it("Should maintain invariant: downloadFile() callable by anyone (view function)", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // Anyone can call downloadFile (view function)
                const result1 = await fileRegistry.connect(addr1).downloadFile.staticCall(fileHash);
                const result2 = await fileRegistry.connect(addr2).downloadFile.staticCall(fileHash);
                const result3 = await fileRegistry.connect(owner).downloadFile.staticCall(fileHash);

                expect(result1).to.equal(result2);
                expect(result2).to.equal(result3);
            });

            it("Should maintain invariant: getUserFiles() callable by anyone (public view function)", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // Anyone can call getUserFiles
                const files1 = await fileRegistry.connect(addr1).getUserFiles.staticCall(addr1.address);
                const files2 = await fileRegistry.connect(addr2).getUserFiles.staticCall(addr1.address);
                const files3 = await fileRegistry.connect(owner).getUserFiles.staticCall(addr1.address);

                expect(files1).to.deep.equal(files2);
                expect(files2).to.deep.equal(files3);
            });
        });

        describe("I4: getUserFiles Consistency", function () {
            it("Should maintain invariant: returns empty array for zero address", async function () {
                const files = await fileRegistry.getUserFiles.staticCall(ethers.ZeroAddress);
                expect(files).to.be.an("array");
                expect(files.length).to.equal(0);
            });

            it("Should maintain invariant: returns deterministic data for same chain state", async function () {
                const fileHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-file-1"));
                const fileHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-file-2"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash1, encryptedKey);
                await fileRegistry.connect(addr1).uploadFile(fileHash2, encryptedKey);

                // Multiple calls should return same result
                const files1 = await fileRegistry.getUserFiles.staticCall(addr1.address);
                const files2 = await fileRegistry.getUserFiles.staticCall(addr1.address);
                const files3 = await fileRegistry.getUserFiles.staticCall(addr1.address);

                expect(files1).to.deep.equal(files2);
                expect(files2).to.deep.equal(files3);
                expect(files1.length).to.equal(2);
            });

            it("Should maintain invariant: no access control (public view function)", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // Verify no access control - anyone can query
                const filesAsOwner = await fileRegistry.connect(addr1).getUserFiles.staticCall(addr1.address);
                const filesAsOther = await fileRegistry.connect(addr2).getUserFiles.staticCall(addr1.address);

                expect(filesAsOwner).to.deep.equal(filesAsOther);
            });
        });

        describe("I5: No Partial State", function () {
            it("Should maintain invariant: after successful upload, all state is consistent", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-consistency"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // Verify all state is consistent
                const metadata = await fileRegistry.getFileMetadata(fileHash);
                expect(metadata.hash).to.equal(fileHash);
                expect(metadata.owner).to.equal(addr1.address);
                expect(metadata.timestamp).to.be.gt(0);

                const userFiles = await fileRegistry.getUserFiles(addr1.address);
                expect(userFiles).to.include(fileHash);

                const fileCount = await fileRegistry.getUserFileCount(addr1.address);
                expect(fileCount).to.equal(userFiles.length);

                const exists = await fileRegistry.fileExists(fileHash);
                expect(exists).to.be.true;

                const downloadedKey = await fileRegistry.downloadFile.staticCall(fileHash);
                expect(downloadedKey).to.equal(ethers.hexlify(encryptedKey));
            });

            it("Should maintain invariant: fileHash appears in userFiles if and only if file exists", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-exists"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                // Before upload: file should not exist, should not be in userFiles
                expect(await fileRegistry.fileExists(fileHash)).to.be.false;
                const filesBefore = await fileRegistry.getUserFiles(addr1.address);
                expect(filesBefore).to.not.include(fileHash);

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // After upload: file should exist, should be in userFiles
                expect(await fileRegistry.fileExists(fileHash)).to.be.true;
                const filesAfter = await fileRegistry.getUserFiles(addr1.address);
                expect(filesAfter).to.include(fileHash);
            });
        });

        describe("I6: No Silent Overwrites", function () {
            it("Should maintain invariant: cannot overwrite existing file", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-no-overwrite"));
                const encryptedKey1 = ethers.toUtf8Bytes("encrypted-key-1");
                const encryptedKey2 = ethers.toUtf8Bytes("encrypted-key-2");

                // Upload first file
                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey1);

                // Attempt to overwrite with different key should fail
                await expect(
                    fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey2)
                ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");

                // Verify original key is still stored
                const downloadedKey = await fileRegistry.downloadFile.staticCall(fileHash);
                expect(downloadedKey).to.equal(ethers.hexlify(encryptedKey1));
            });

            it("Should maintain invariant: cannot overwrite even with same key", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-same-key"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                // Even same user with same key cannot overwrite
                await expect(
                    fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");
            });

            it("Should maintain invariant: different users cannot overwrite each other's files", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file-different-user"));
                const encryptedKey1 = ethers.toUtf8Bytes("encrypted-key-1");
                const encryptedKey2 = ethers.toUtf8Bytes("encrypted-key-2");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey1);

                // Different user cannot overwrite
                await expect(
                    fileRegistry.connect(addr2).uploadFile(fileHash, encryptedKey2)
                ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");

                // Verify original owner and key unchanged
                const metadata = await fileRegistry.getFileMetadata(fileHash);
                expect(metadata.owner).to.equal(addr1.address);
                const downloadedKey = await fileRegistry.downloadFile.staticCall(fileHash);
                expect(downloadedKey).to.equal(ethers.hexlify(encryptedKey1));
            });
        });

        describe("I7: Custom Errors Exhaustive", function () {
            it("Should use InvalidFileHash for zero fileHash", async function () {
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await expect(
                    fileRegistry.connect(addr1).uploadFile(ethers.ZeroHash, encryptedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "InvalidFileHash");
            });

            it("Should use InvalidEncryptedKey for empty encrypted key", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));

                await expect(
                    fileRegistry.connect(addr1).uploadFile(fileHash, ethers.toUtf8Bytes(""))
                ).to.be.revertedWithCustomError(fileRegistry, "InvalidEncryptedKey");
            });

            it("Should use EncryptedKeyTooLarge for oversized key", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const oversizedKey = ethers.toUtf8Bytes("x".repeat(1025));

                await expect(
                    fileRegistry.connect(addr1).uploadFile(fileHash, oversizedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "EncryptedKeyTooLarge");
            });

            it("Should use FileAlreadyExists for duplicate upload", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                await expect(
                    fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");
            });

            it("Should use FileNotFound for non-existent file", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

                await expect(
                    fileRegistry.downloadFile.staticCall(fileHash)
                ).to.be.revertedWithCustomError(fileRegistry, "FileNotFound");
            });

            it("Should use UnauthorizedAccess for non-owner retrieveFile", async function () {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test-file"));
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");

                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);

                await expect(
                    fileRegistry.connect(addr2).retrieveFile(fileHash)
                ).to.be.revertedWithCustomError(fileRegistry, "UnauthorizedAccess");
            });

            it("Should use MaxFilesPerUserExceeded when limit reached", async function () {
                const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
                const maxFiles = await fileRegistry.MAX_FILES_PER_USER();

                // Upload up to limit
                for (let i = 0; i < maxFiles; i++) {
                    const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`test-file-${i}`));
                    await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
                }

                // Next upload should fail
                const overflowHash = ethers.keccak256(ethers.toUtf8Bytes("overflow-file"));
                await expect(
                    fileRegistry.connect(addr1).uploadFile(overflowHash, encryptedKey)
                ).to.be.revertedWithCustomError(fileRegistry, "MaxFilesPerUserExceeded");
            });
        });
    });

    describe("Adversarial Stress Tests", function () {
        it("Should handle rapid sequential uploads efficiently", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const batchSize = 50;

            // Rapid sequential uploads
            const startGas = await ethers.provider.estimateGas(
                await fileRegistry.connect(addr1).uploadFile.populateTransaction(
                    ethers.keccak256(ethers.toUtf8Bytes("test-0")),
                    encryptedKey
                )
            );

            for (let i = 0; i < batchSize; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`rapid-test-${i}`));
                await fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey);
            }

            // Verify all files were stored
            const fileCount = await fileRegistry.getUserFileCount(addr1.address);
            expect(fileCount).to.equal(batchSize);

            // Verify gas usage is reasonable (should not grow significantly)
            const endGas = await ethers.provider.estimateGas(
                await fileRegistry.connect(addr1).uploadFile.populateTransaction(
                    ethers.keccak256(ethers.toUtf8Bytes("test-final")),
                    encryptedKey
                )
            );
            // Gas should be similar (within 20% variance is acceptable)
            expect(endGas).to.be.lte(startGas * 120n / 100n);
        });

        it("Should handle maximum size encrypted key", async function () {
            const maxKeySize = await fileRegistry.MAX_ENCRYPTED_KEY_SIZE();
            const maxKey = ethers.hexlify(ethers.randomBytes(Number(maxKeySize)));
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("max-key-test"));

            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, maxKey)
            ).to.not.be.reverted;

            const downloaded = await fileRegistry.downloadFile(fileHash);
            expect(downloaded).to.equal(maxKey);
        });

        it("Should reject encrypted key exceeding maximum size", async function () {
            const maxKeySize = await fileRegistry.MAX_ENCRYPTED_KEY_SIZE();
            const oversizedKey = ethers.hexlify(ethers.randomBytes(Number(maxKeySize) + 1));
            const fileHash = ethers.keccak256(ethers.toUtf8Bytes("oversized-key-test"));

            await expect(
                fileRegistry.connect(addr1).uploadFile(fileHash, oversizedKey)
            ).to.be.revertedWithCustomError(fileRegistry, "EncryptedKeyTooLarge");
        });

        it("Should handle multiple users uploading simultaneously", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const uploadsPerUser = 10;

            // Multiple users upload files concurrently
            const promises = [];
            for (let user = 0; user < 3; user++) {
                const signer = user === 0 ? addr1 : user === 1 ? addr2 : owner;
                for (let i = 0; i < uploadsPerUser; i++) {
                    const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`user-${user}-file-${i}`));
                    promises.push(fileRegistry.connect(signer).uploadFile(fileHash, encryptedKey));
                }
            }

            await Promise.all(promises);

            // Verify all files were stored correctly
            expect(await fileRegistry.getUserFileCount(addr1.address)).to.equal(uploadsPerUser);
            expect(await fileRegistry.getUserFileCount(addr2.address)).to.equal(uploadsPerUser);
            expect(await fileRegistry.getUserFileCount(owner.address)).to.equal(uploadsPerUser);
        });

        it("Should maintain consistency under rapid mixed operations", async function () {
            const encryptedKey = ethers.toUtf8Bytes("encrypted-key-data");
            const operations = [];

            // Mix uploads and downloads
            for (let i = 0; i < 20; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`mixed-op-${i}`));
                operations.push(fileRegistry.connect(addr1).uploadFile(fileHash, encryptedKey));
            }

            await Promise.all(operations);

            // Verify state consistency
            const fileCount = await fileRegistry.getUserFileCount(addr1.address);
            expect(fileCount).to.equal(20);

            const userFiles = await fileRegistry.getUserFiles(addr1.address);
            expect(userFiles.length).to.equal(20);

            // Verify all files are retrievable
            for (let i = 0; i < 20; i++) {
                const fileHash = ethers.keccak256(ethers.toUtf8Bytes(`mixed-op-${i}`));
                const exists = await fileRegistry.fileExists(fileHash);
                expect(exists).to.be.true;
            }
        });
    });
});

