/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Deployment information loader
 * Reads contract addresses from deployment artifacts based on network
 */

const fs = require('fs')
const path = require('path')
const { getRuntimeConfig } = require('./runtimeConfig')

const DEPLOYMENTS_DIR = path.join(__dirname, '../../deployments')

/**
 * Load deployment artifact for current network
 * @returns {Object} Deployment artifact
 */
function loadDeploymentArtifact() {
  const config = getRuntimeConfig()
  const artifactPath = path.join(DEPLOYMENTS_DIR, `${config.networkName}.json`)

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Deployment artifact not found: ${artifactPath}. Run deployment script for network: ${config.networkName}`)
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))

  // Validate artifact
  if (artifact.network !== config.networkName) {
    throw new Error(`Deployment artifact network mismatch: expected ${config.networkName}, got ${artifact.network}`)
  }

  if (artifact.chainId && artifact.chainId !== config.chainId) {
    throw new Error(`Deployment artifact chainId mismatch: expected ${config.chainId}, got ${artifact.chainId}`)
  }

  if (!artifact.contracts || !artifact.contracts.FileRegistry || !artifact.contracts.FileRegistry.address) {
    throw new Error('Deployment artifact missing FileRegistry contract address')
  }

  const contractAddress = artifact.contracts.FileRegistry.address
  if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error(`Invalid contract address format: ${contractAddress}`)
  }

  return artifact
}

/**
 * Get FileRegistry contract address for current network
 * @returns {string} Contract address
 */
function getFileRegistryAddress() {
  const artifact = loadDeploymentArtifact()
  return artifact.contracts.FileRegistry.address
}

/**
 * Get chain ID from deployment artifact
 * @returns {number} Chain ID
 */
function getChainId() {
  const artifact = loadDeploymentArtifact()
  return artifact.chainId || null
}

/**
 * Get deployment timestamp
 * @returns {number|null} Deployment timestamp
 */
function getDeploymentTimestamp() {
  const artifact = loadDeploymentArtifact()
  return artifact.contracts.FileRegistry.deployedAt || null
}

module.exports = {
  loadDeploymentArtifact,
  getFileRegistryAddress,
  getChainId,
  getDeploymentTimestamp
}

