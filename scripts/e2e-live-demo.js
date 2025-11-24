/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const fs = require("fs");
const path = require("path");
const { logger } = require("../src/utils/logger");
const { uploadFileToBlockchain, downloadFileFromBlockchain } = require("../src/index");
const { getFileRegistryAddress } = require("../src/config/deploymentInfo");
const { getRuntimeConfig } = require("../src/config/runtimeConfig");

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
        // Use Hardhat default account #0 private key for local testing (well-known, safe for local dev only)
        // In production, use environment variable: process.env.PRIVATE_KEY
        const senderPrivateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

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

        const uploadResult = await uploadFileToBlockchain(
            demoFilePath,
            senderPrivateKey,
            CONTRACT_ADDRESS
        );

        logger.info("E2E_DEMO_UPLOAD_SUCCESS", {
            event: "E2E_DEMO_UPLOAD_SUCCESS",
            actor: "sender",
            fileHash: uploadResult.fileHash ? `${uploadResult.fileHash.substring(0, 8)}...` : "unknown",
            cidMasked: uploadResult.ipfsHash ? `${uploadResult.ipfsHash.substring(0, 8)}...` : "unknown",
            txHash: uploadResult.txHash ? `${uploadResult.txHash.substring(0, 8)}...` : "unknown",
            timestamp: new Date().toISOString()
        });

        // Wait for transaction to be fully mined
        await new Promise(resolve => setTimeout(resolve, 2000));

        const outputDir = path.join(__dirname, "../data/temp");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, `demo-download-${Date.now()}.txt`);

        logger.info("E2E_DEMO_DOWNLOAD_START", {
            event: "E2E_DEMO_DOWNLOAD_START",
            actor: "receiver",
            fileHash: uploadResult.fileHash ? `${uploadResult.fileHash.substring(0, 8)}...` : "unknown",
            timestamp: new Date().toISOString()
        });

        await downloadFileFromBlockchain(
            uploadResult.fileHash,
            CONTRACT_ADDRESS,
            outputPath
        );

        const downloadedContent = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        fs.unlinkSync(demoFilePath);

        const contentMatches = downloadedContent.equals(originalContent);

        logger.info("E2E_DEMO_DOWNLOAD_SUCCESS", {
            event: "E2E_DEMO_DOWNLOAD_SUCCESS",
            actor: "receiver",
            fileHash: uploadResult.fileHash ? `${uploadResult.fileHash.substring(0, 8)}...` : "unknown",
            fileSize: downloadedContent.length,
            timestamp: new Date().toISOString()
        });

        logger.info("E2E_LIVE_DEMO_SUCCESS", {
            event: "E2E_LIVE_DEMO_SUCCESS",
            fileHash: uploadResult.fileHash ? `${uploadResult.fileHash.substring(0, 8)}...` : "unknown",
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

