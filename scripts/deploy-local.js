/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments");

async function main() {
    console.log("Deploying FileRegistry contract to local network...");

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);

    const FileRegistry = await ethers.getContractFactory("FileRegistry");
    const fileRegistry = await FileRegistry.deploy();
    await fileRegistry.waitForDeployment();

    const address = await fileRegistry.getAddress();
    console.log("FileRegistry deployed to:", address);

    // Get chain ID
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    // Create deployment artifact
    const artifact = {
        network: "local",
        chainId,
        contracts: {
            FileRegistry: {
                address,
                deployedAt: Math.floor(Date.now() / 1000)
            }
        }
    };

    // Ensure deployments directory exists
    if (!fs.existsSync(DEPLOYMENTS_DIR)) {
        fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
    }

    // Write atomically (temp file + rename)
    const artifactPath = path.join(DEPLOYMENTS_DIR, "local.json");
    const tempPath = artifactPath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(artifact, null, 2));
    fs.renameSync(tempPath, artifactPath);

    console.log("Deployment artifact written to:", artifactPath);
    console.log("\nSave this address to your .env file as CONTRACT_ADDRESS (optional, deployment artifact is used)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

