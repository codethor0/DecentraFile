/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const { ethers } = require("hardhat");
const { logger } = require("../src/utils/logger");

async function waitForHardhatNode() {
    const maxAttempts = 30;
    const delay = 2000;
    const rpcUrl = process.env.RPC_URL || "http://hardhat:8545";

    logger.info("Waiting for Hardhat node to be ready...", { rpcUrl });

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const blockNumber = await provider.getBlockNumber();
            if (blockNumber >= 0) {
                logger.info("Hardhat node is ready", { blockNumber, rpcUrl });
                return true;
            }
        } catch (error) {
            if (i < maxAttempts - 1) {
                logger.debug(`Attempt ${i + 1}/${maxAttempts} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error("Hardhat node did not become ready in time");
}

async function deployContract() {
    logger.info("Deploying FileRegistry contract...");

    const { getRuntimeConfig } = require("../src/config/runtimeConfig");
    const runtimeConfig = getRuntimeConfig();

    // Only deploy if network is local
    if (runtimeConfig.networkName !== "local") {
        logger.info("Skipping deployment for non-local network", { network: runtimeConfig.networkName });
        return null;
    }

    const hre = require("hardhat");
    const provider = new hre.ethers.JsonRpcProvider(runtimeConfig.rpcUrl);
    const signer = await provider.getSigner(0);

    const FileRegistry = await hre.ethers.getContractFactory("FileRegistry", signer);
    const fileRegistry = await FileRegistry.deploy();
    const deployTx = fileRegistry.deploymentTransaction();
    if (deployTx) {
        await deployTx.wait();
    }
    await fileRegistry.waitForDeployment();

    const address = await fileRegistry.getAddress();
    logger.info("FileRegistry deployed", { contractAddress: address });

    // Verify deployment
    const code = await provider.getCode(address);
    if (!code || code === "0x" || code.length <= 2) {
        throw new Error(`Contract deployment verification failed: no code at ${address}`);
    }
    logger.info("Contract deployment verified", { codeLength: code.length });

    // Write deployment artifact
    const fs = require("fs");
    const path = require("path");
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const network = await provider.getNetwork();
    const artifact = {
        network: "local",
        chainId: Number(network.chainId),
        contracts: {
            FileRegistry: {
                address,
                deployedAt: Math.floor(Date.now() / 1000)
            }
        }
    };

    const artifactPath = path.join(deploymentsDir, "local.json");
    const tempPath = artifactPath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(artifact, null, 2));
    fs.renameSync(tempPath, artifactPath);

    // Also write legacy file for backward compatibility
    const contractAddressFile = "/app/data/contract-address.txt";
    const dataDir = "/app/data";
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(contractAddressFile, address);

    return address;
}

async function startServer() {
    logger.info("Starting HTTP server...");
    require("../src/server.js");
}

async function main() {
    try {
        await waitForHardhatNode();
        await deployContract();
        await startServer();
    } catch (error) {
        logger.error("Startup failed", { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

main();

