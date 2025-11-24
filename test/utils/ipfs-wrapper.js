/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * IPFS wrapper for testability
 * Allows injection of mock IPFS client for testing
 */

let ipfsClient = null;

/**
 * Set IPFS client (for testing)
 * @param {Object} client - IPFS client instance
 */
function setIPFSClient(client) {
    ipfsClient = client;
}

/**
 * Get IPFS client
 * @returns {Object} IPFS client instance
 */
function getIPFSClient() {
    if (ipfsClient) {
        return ipfsClient;
    }

    // Return real IPFS client
    const { create } = require("ipfs-http-client");
    return create({
        url: process.env.IPFS_URL || "https://ipfs.infura.io:5001/api/v0",
        headers: {
            authorization: process.env.IPFS_AUTH ? `Basic ${process.env.IPFS_AUTH}` : undefined
        }
    });
}

/**
 * Reset to default IPFS client
 */
function resetIPFSClient() {
    ipfsClient = null;
}

module.exports = {
    setIPFSClient,
    getIPFSClient,
    resetIPFSClient
};

