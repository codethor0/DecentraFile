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
    console.log("Deploying FileRegistry contract to testnet...");

    const networkName = process.env.DECENTRAFILE_NETWORK || "testnet";
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!rpcUrl) {
        throw new Error("RPC_URL environment variable is required for testnet deployment");
    }

    if (!privateKey) {
        throw new Error("PRIVATE_KEY environment variable is required for testnet deployment");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const deployerAddress = await signer.getAddress();
    console.log("Deploying with account:", deployerAddress);

    const balance = await provider.getBalance(deployerAddress);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
        throw new Error("Account has zero balance. Fund the account before deploying.");
    }

    const FileRegistry = await ethers.getContractFactory("FileRegistry", signer);
    const fileRegistry = await FileRegistry.deploy();
    await fileRegistry.waitForDeployment();

    const address = await fileRegistry.getAddress();
    console.log("FileRegistry deployed to:", address);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    // Create deployment artifact
    const artifact = {
        network: networkName,
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
    const artifactPath = path.join(DEPLOYMENTS_DIR, `${networkName}.json`);
    const tempPath = artifactPath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(artifact, null, 2));
    fs.renameSync(tempPath, artifactPath);

    console.log("Deployment artifact written to:", artifactPath);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

