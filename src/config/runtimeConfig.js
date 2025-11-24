/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Centralized runtime configuration for DecentraFile
 * Reads environment variables and provides validated configuration
 */

const ALLOWED_NETWORKS = ['local', 'testnet', 'mainnet']
const ALLOWED_STORAGE_MODES = ['mock', 'ipfs']

/**
 * Get and validate network configuration
 * @returns {Object} Configuration object
 */
function getRuntimeConfig() {
  const networkName = (process.env.DECENTRAFILE_NETWORK || 'local').toLowerCase()
  const storageMode = (process.env.DECENTRAFILE_STORAGE || 'mock').toLowerCase()

  // Validate network
  if (!ALLOWED_NETWORKS.includes(networkName)) {
    throw new Error(`Invalid DECENTRAFILE_NETWORK: ${networkName}. Allowed values: ${ALLOWED_NETWORKS.join(', ')}`)
  }

  // Validate storage mode
  if (!ALLOWED_STORAGE_MODES.includes(storageMode)) {
    throw new Error(`Invalid DECENTRAFILE_STORAGE: ${storageMode}. Allowed values: ${ALLOWED_STORAGE_MODES.join(', ')}`)
  }

  // Determine RPC URL
  let rpcUrl = process.env.RPC_URL
  if (!rpcUrl) {
    if (networkName === 'local') {
      rpcUrl = 'http://hardhat:8545'
    } else {
      throw new Error(`RPC_URL environment variable is required for network: ${networkName}`)
    }
  }

  // Determine chain ID
  let chainId = process.env.CHAIN_ID
  if (chainId) {
    chainId = parseInt(chainId, 10)
    if (isNaN(chainId) || chainId < 1) {
      throw new Error(`Invalid CHAIN_ID: ${process.env.CHAIN_ID}`)
    }
  } else {
    // Default chain IDs per network
    if (networkName === 'local') {
      chainId = 31337
    } else if (networkName === 'testnet') {
      chainId = 80001 // Polygon Mumbai testnet default
    } else if (networkName === 'mainnet') {
      chainId = 137 // Polygon mainnet default
    }
  }

  // Determine IPFS endpoint
  let ipfsEndpoint = process.env.IPFS_ENDPOINT
  if (storageMode === 'ipfs' && !ipfsEndpoint) {
    throw new Error('IPFS_ENDPOINT environment variable is required when DECENTRAFILE_STORAGE=ipfs')
  }
  if (storageMode === 'mock') {
    ipfsEndpoint = null
  }

  return {
    networkName,
    rpcUrl,
    chainId,
    storageMode,
    ipfsEndpoint
  }
}

module.exports = {
  getRuntimeConfig,
  ALLOWED_NETWORKS,
  ALLOWED_STORAGE_MODES
}

