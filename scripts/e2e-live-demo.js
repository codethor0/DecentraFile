/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const fs = require("fs");
const path = require("path");
const { logger } = require("../src/utils/logger");
const { getFileRegistryAddress } = require("../src/config/deploymentInfo");
const { getRuntimeConfig } = require("../src/config/runtimeConfig");
const { ethers } = require("ethers");
const { uploadFile: uploadToIPFS } = require("../src/ipfs");
const {
    generateSymmetricKey,
    encryptFile,
    secureZero
} = require("../src/crypto/crypto");

// Get contract address from deployment artifact
let CONTRACT_ADDRESS;
try {
    CONTRACT_ADDRESS = getFileRegistryAddress();
    const config = getRuntimeConfig();
    logger.info("Loaded contract address from deployment artifact", {
        network: config.networkName,
        storageMode: config.storageMode,
        contractAddress: CONTRACT_ADDRESS.substring(0, 10) + "..."
    });
} catch (error) {
    // Fallback to legacy file-based approach
    const contractAddressFile = "/app/data/contract-address.txt";
    if (fs.existsSync(contractAddressFile)) {
        CONTRACT_ADDRESS = fs.readFileSync(contractAddressFile, "utf8").trim();
        logger.info("Loaded contract address from legacy file", { contractAddress: CONTRACT_ADDRESS.substring(0, 10) + "..." });
    } else {
        logger.error("Contract address not found", { error: error.message });
        process.exit(1);
    }
}

async function runE2EDemo() {
    logger.info("E2E_DEMO_START", {
        event: "E2E_DEMO_START",
        timestamp: new Date().toISOString()
    });

    try {
        // Get runtime config
        const config = getRuntimeConfig();
        const rpcUrl = config.rpcUrl || "http://localhost:8545";

        // Create provider and wallet using ethers (matching integration tests)
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const senderPrivateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const wallet = new ethers.Wallet(senderPrivateKey, provider);

        // Get network info
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        logger.info("Network configuration", {
            chainId,
            contractAddress: CONTRACT_ADDRESS,
            rpcUrl
        });

        const testDataDir = path.join(__dirname, "../test/testdata");
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }

        const demoFilePath = path.join(testDataDir, "demo.txt");
        const originalContent = Buffer.from("DecentraFile E2E Demo - Test Content\nTimestamp: " + Date.now());
        fs.writeFileSync(demoFilePath, originalContent);

        logger.info("E2E_DEMO_UPLOAD_START", {
            event: "E2E_DEMO_UPLOAD_START",
            actor: "sender",
            fileSize: originalContent.length,
            timestamp: new Date().toISOString()
        });

        // Step 1: Encrypt file (reuse existing crypto logic)
        const symmetricKey = generateSymmetricKey();
        const { ciphertext, iv, authTag } = encryptFile(originalContent, symmetricKey);

        // Step 2: Upload to IPFS (reuse existing IPFS logic)
        const ipfsHash = await uploadToIPFS(ciphertext);

        // Step 3: Generate fileHash (same as src/index.js)
        const fileHash = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));

        // Step 4: Prepare encrypted key (same format as src/index.js)
        const keyMetadata = {
            iv,
            tag: authTag,
            key: symmetricKey.toString("hex")
        };
        const wrappedKey = Buffer.from(JSON.stringify(keyMetadata));
        const wrappedKeyHex = "0x" + wrappedKey.toString("hex");

        // Step 5: Upload to blockchain using ethers (matching integration tests)
        // Use Hardhat's getContractFactory to ensure correct ABI and bytecode
        const hre = require("hardhat");
        const FileRegistry = await hre.ethers.getContractFactory("FileRegistry");
        let contract = FileRegistry.attach(CONTRACT_ADDRESS).connect(wallet);

        // Verify contract is deployed (allow for deployment timing)
        let code = await provider.getCode(CONTRACT_ADDRESS);
        let actualContractAddress = CONTRACT_ADDRESS;

        if (!code || code === "0x" || code.length <= 2) {
            // Contract might not be deployed yet - try deploying if on local network
            if (config.networkName === "local") {
                logger.info("Contract not found, deploying to local network...");
                const deployer = new ethers.Wallet(senderPrivateKey, provider);
                const FileRegistryFactory = await hre.ethers.getContractFactory("FileRegistry", deployer);
                const deployedContract = await FileRegistryFactory.deploy();
                const deployTx = deployedContract.deploymentTransaction();
                if (deployTx) {
                    await deployTx.wait();
                }
                await deployedContract.waitForDeployment();
                actualContractAddress = await deployedContract.getAddress();
                logger.info("Contract deployed", { address: actualContractAddress });

                // Wait a bit and verify code exists
                await new Promise(resolve => setTimeout(resolve, 1000));
                code = await provider.getCode(actualContractAddress);

                if (!code || code === "0x" || code.length <= 2) {
                    throw new Error(`Contract deployed but no code found at ${actualContractAddress}`);
                }

                // Update contract reference if address changed
                if (actualContractAddress.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
                    logger.warn("Deployed contract address differs from artifact", {
                        artifact: CONTRACT_ADDRESS,
                        deployed: actualContractAddress
                    });
                    // Use the deployed address
                    contract = FileRegistry.attach(actualContractAddress).connect(wallet);
                }
            } else {
                throw new Error(`No contract code found at ${CONTRACT_ADDRESS}`);
            }
        }

        logger.info("Starting file upload", {
            filePath: "demo.txt",
            contractAddress: CONTRACT_ADDRESS,
            fileHash: fileHash.substring(0, 10) + "...",
            encryptedKeyLength: wrappedKeyHex.length
        });

        const tx = await contract.uploadFile(fileHash, wrappedKeyHex);
        const receipt = await tx.wait(1);

        // Verify transaction execution
        if (receipt.status !== 1) {
            throw new Error(`Transaction failed with status ${receipt.status}`);
        }

        // Debug: Check receipt structure
        logger.info("Transaction receipt details", {
            status: receipt.status,
            logsLength: receipt.logs ? receipt.logs.length : 0,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber
        });

        // Verify events were emitted
        if (!receipt.logs || receipt.logs.length === 0) {
            // Check if we can get events from the transaction response
            const txResponse = await provider.getTransactionReceipt(receipt.hash);
            logger.info("Raw receipt from provider", {
                logsLength: txResponse.logs ? txResponse.logs.length : 0,
                status: txResponse.status
            });

            if (!txResponse.logs || txResponse.logs.length === 0) {
                throw new Error("Transaction succeeded but no events were emitted");
            }
            // Use logs from raw receipt
            receipt.logs = txResponse.logs;
        }

        // Decode FileUploaded event
        let fileUploadedEvent = null;
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                if (parsed && parsed.name === "FileUploaded") {
                    fileUploadedEvent = parsed;
                    break;
                }
            } catch (e) {
                // Not a FileUploaded event, continue
            }
        }

        if (fileUploadedEvent) {
            logger.info("FileUploaded event decoded", {
                fileHash: fileUploadedEvent.args[0],
                owner: fileUploadedEvent.args[1],
                timestamp: fileUploadedEvent.args[2].toString()
            });
        } else {
            logger.warn("FileUploaded event not found in receipt logs", {
                logsCount: receipt.logs.length
            });
        }

        logger.info("E2E_DEMO_UPLOAD_SUCCESS", {
            event: "E2E_DEMO_UPLOAD_SUCCESS",
            actor: "sender",
            fileHash: fileHash.substring(0, 10) + "...",
            cidMasked: ipfsHash.substring(0, 10) + "...",
            txHash: receipt.hash.substring(0, 10) + "...",
            receiptStatus: receipt.status,
            logsCount: receipt.logs.length,
            timestamp: new Date().toISOString()
        });

        // Verify state is readable using the same provider
        const fileExists = await contract.fileExists(fileHash);
        if (!fileExists) {
            throw new Error("File does not exist on blockchain after upload");
        }

        logger.info("State readable confirmed", {
            fileHash: fileHash.substring(0, 10) + "...",
            fileExists: true
        });

        // Clean up symmetric key
        secureZero(symmetricKey);

        // Store IPFS hash mapping for download (required by downloadFileFromBlockchain)
        // The mapping format expected by loadIPFSMapping is an object with fileHash -> ipfsHash entries
        const tempMappingFile = path.join(__dirname, "../data/temp-ipfs-mapping.json");
        const mappingDir = path.join(__dirname, "../data");
        if (!fs.existsSync(mappingDir)) {
            fs.mkdirSync(mappingDir, { recursive: true });
        }
        // Format: { "fileHash": "ipfsHash" } - must match loadIPFSMapping format
        const mapping = {};
        mapping[fileHash] = ipfsHash;
        fs.writeFileSync(tempMappingFile, JSON.stringify(mapping, null, 2));

        // Set environment variable BEFORE requiring the download function
        // This ensures the mapping is loaded when the module initializes
        const originalMappingFile = process.env.IPFS_MAPPING_FILE;
        process.env.IPFS_MAPPING_FILE = tempMappingFile;

        // Reload the index module to pick up the mapping file
        delete require.cache[require.resolve("../src/index")];
        // Re-require downloadFileFromBlockchain after setting the env var
        const { downloadFileFromBlockchain: downloadFn } = require("../src/index");

        const outputDir = path.join(__dirname, "../data/temp");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, `demo-download-${Date.now()}.txt`);

        logger.info("E2E_DEMO_DOWNLOAD_START", {
            event: "E2E_DEMO_DOWNLOAD_START",
            actor: "receiver",
            fileHash: fileHash.substring(0, 10) + "...",
            timestamp: new Date().toISOString()
        });

        // Download using the reloaded downloadFileFromBlockchain function
        await downloadFn(
            fileHash,
            CONTRACT_ADDRESS,
            outputPath
        );

        // Clean up temp mapping file
        if (fs.existsSync(tempMappingFile)) {
            fs.unlinkSync(tempMappingFile);
        }

        // Restore original env var if it existed
        if (originalMappingFile) {
            process.env.IPFS_MAPPING_FILE = originalMappingFile;
        } else {
            delete process.env.IPFS_MAPPING_FILE;
        }

        const downloadedContent = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        fs.unlinkSync(demoFilePath);

        const contentMatches = downloadedContent.equals(originalContent);

        logger.info("E2E_DEMO_DOWNLOAD_SUCCESS", {
            event: "E2E_DEMO_DOWNLOAD_SUCCESS",
            actor: "receiver",
            fileHash: fileHash.substring(0, 10) + "...",
            fileSize: downloadedContent.length,
            timestamp: new Date().toISOString()
        });

        logger.info("E2E_LIVE_DEMO_SUCCESS", {
            event: "E2E_LIVE_DEMO_SUCCESS",
            fileHash: fileHash.substring(0, 10) + "...",
            contentMatches,
            originalSize: originalContent.length,
            downloadedSize: downloadedContent.length,
            timestamp: new Date().toISOString()
        });

        if (!contentMatches) {
            logger.error("E2E_DEMO_CONTENT_MISMATCH", {
                event: "E2E_DEMO_CONTENT_MISMATCH",
                originalSize: originalContent.length,
                downloadedSize: downloadedContent.length
            });
            process.exit(1);
        }

        logger.info("E2E_DEMO_END", {
            event: "E2E_DEMO_END",
            success: true,
            timestamp: new Date().toISOString()
        });

        process.exit(0);
    } catch (error) {
        logger.error("E2E_DEMO_FAILURE", {
            event: "E2E_DEMO_FAILURE",
            error: error.message,
            timestamp: new Date().toISOString()
        });
        process.exit(1);
    }
}

runE2EDemo();
