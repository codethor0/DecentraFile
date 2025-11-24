/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying FileRegistry contract...");

    const FileRegistry = await ethers.getContractFactory("FileRegistry");
    const fileRegistry = await FileRegistry.deploy();

    await fileRegistry.waitForDeployment();

    const address = await fileRegistry.getAddress();
    console.log("FileRegistry deployed to:", address);
    console.log("\nSave this address to your .env file as CONTRACT_ADDRESS");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

