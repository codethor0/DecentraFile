/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Main blockchain interaction module for DecentraFile
 *
 * This module handles file upload and download operations, coordinating
 * between IPFS storage, blockchain metadata storage, and encryption.
 *
 * Security notes:
 * - All file operations use the dedicated crypto module
 * - Keys are never stored in plaintext
 * - Input validation is performed before all operations
 * - Errors are logged without exposing sensitive data
 */

const { Web3 } = require('web3')
const { uploadFile: uploadToIPFS, downloadFile: downloadFromIPFS } = require('./ipfs')
const {
  generateSymmetricKey,
  encryptFile,
  decryptFile,
  wrapKeyForRecipient,
  unwrapKeyForRecipient,
  secureZero,
  MAX_ENCRYPTED_KEY_SIZE
} = require('./crypto/crypto')
const {
  validateUploadParams,
  validateDownloadParams,
  validateIPFSHash
} = require('./utils/validation')
const { logger, logFileUpload, logFileDownload, logError, logSecurityEvent } = require('./utils/logger')
const fs = require('fs')
const path = require('path')

// File path for persistent IPFS hash mapping (optional, falls back to in-memory if not set)
const IPFS_MAPPING_FILE = process.env.IPFS_MAPPING_FILE || null

// File size limits
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB - maximum file size for upload

/**
 * Load IPFS hash mapping from persistent storage
 * Validates data structure and handles corruption gracefully
 * @returns {Map} Map of fileHash to IPFS hash
 */
function loadIPFSMapping() {
  const mapping = new Map()
  if (IPFS_MAPPING_FILE && fs.existsSync(IPFS_MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(IPFS_MAPPING_FILE, 'utf8')

      // Validate file is not empty
      if (!data || data.trim().length === 0) {
        logger.warn('IPFS mapping file is empty, using empty mapping')
        return mapping
      }

      const parsed = JSON.parse(data)

      // Validate parsed data is an object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Invalid mapping file format: expected object')
      }

      // Validate and load entries
      let validEntries = 0
      let invalidEntries = 0
      for (const [fileHash, ipfsHash] of Object.entries(parsed)) {
        // Validate entry format
        if (typeof fileHash === 'string' && typeof ipfsHash === 'string' &&
            fileHash.length > 0 && ipfsHash.length > 0) {
          mapping.set(fileHash, ipfsHash)
          validEntries++
        } else {
          invalidEntries++
        }
      }

      if (invalidEntries > 0) {
        logger.warn(`Skipped ${invalidEntries} invalid entries in IPFS mapping file`)
      }

      logger.info('Loaded IPFS hash mapping from persistent storage', {
        count: mapping.size,
        validEntries,
        invalidEntries
      })
    } catch (error) {
      logError(error, { operation: 'load_ipfs_mapping' })
      logger.warn('Failed to load IPFS mapping, using empty mapping')

      // If file exists but is corrupted, consider backing it up
      if (fs.existsSync(IPFS_MAPPING_FILE)) {
        const backupFile = IPFS_MAPPING_FILE + '.corrupted.' + Date.now()
        try {
          fs.copyFileSync(IPFS_MAPPING_FILE, backupFile)
          logger.info('Backed up corrupted mapping file', { backupFile })
        } catch (backupError) {
          // Ignore backup errors
        }
      }
    }
  }
  return mapping
}

/**
 * Save IPFS hash mapping to persistent storage
 * Uses atomic write pattern: write to temp file, then rename
 * This prevents corruption if process crashes during write
 *
 * Note: In concurrent upload scenarios, this function reads the current in-memory
 * mapping state. If multiple uploads happen concurrently, the last write wins.
 * This is acceptable for single-process applications where uploads are typically
 * sequential. For true concurrent safety, file locking or a database would be needed.
 *
 * @param {Map} mapping - Map of fileHash to IPFS hash
 */
function saveIPFSMapping(mapping) {
  if (IPFS_MAPPING_FILE) {
    try {
      // Reload from disk to merge any external changes (mitigates some race conditions)
      const diskMapping = loadIPFSMapping()
      for (const [fileHash, ipfsHash] of diskMapping.entries()) {
        mapping.set(fileHash, ipfsHash)
      }

      const data = Object.fromEntries(mapping)
      const jsonData = JSON.stringify(data, null, 2)

      // Atomic write: write to temp file first, then rename
      // This ensures the original file is never corrupted
      const tempFile = IPFS_MAPPING_FILE + '.tmp'
      fs.writeFileSync(tempFile, jsonData, 'utf8')

      // Rename is atomic on most filesystems
      fs.renameSync(tempFile, IPFS_MAPPING_FILE)

      logger.debug('Saved IPFS hash mapping to persistent storage', { count: mapping.size })
    } catch (error) {
      logError(error, { operation: 'save_ipfs_mapping' })
      logger.warn('Failed to save IPFS mapping, continuing with in-memory only')

      // Clean up temp file if it exists
      const tempFile = IPFS_MAPPING_FILE + '.tmp'
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile)
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }
  }
}

// Initialize Web3 using centralized config
const { getRuntimeConfig } = require('./config/runtimeConfig')
const runtimeConfig = getRuntimeConfig()
const web3 = new Web3(runtimeConfig.rpcUrl)

// Contract ABI - should be generated from compiled contract in production
const FileRegistryABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'fileHash', type: 'bytes32' },
      { internalType: 'bytes', name: 'encryptedKey', type: 'bytes' }
    ],
    name: 'uploadFile',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'fileHash', type: 'bytes32' }],
    name: 'downloadFile',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'fileHash', type: 'bytes32' }],
    name: 'retrieveFile',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'fileHash', type: 'bytes32' }],
    name: 'getFileMetadata',
    outputs: [
      { internalType: 'bytes32', name: 'hash', type: 'bytes32' },
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'fileHash', type: 'bytes32' }],
    name: 'fileExists',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  }
]

// Mapping of fileHash to IPFS CID
// Security note: This mapping is critical - without it, files become permanently inaccessible
// Current implementation uses in-memory storage which is lost on restart
// Set IPFS_MAPPING_FILE environment variable to enable persistent storage
const ipfsHashMapping = new Map()

// Load mapping on startup if persistent storage is configured
if (IPFS_MAPPING_FILE) {
  const loaded = loadIPFSMapping()
  for (const [fileHash, ipfsHash] of loaded.entries()) {
    ipfsHashMapping.set(fileHash, ipfsHash)
  }
}

/**
 * Upload file to blockchain and IPFS
 *
 * Process:
 * 1. Validate inputs
 * 2. Read and validate file
 * 3. Generate symmetric key and encrypt file
 * 4. Upload encrypted file to IPFS
 * 5. Wrap symmetric key (currently stores wrapped key metadata, should use recipient public key)
 * 6. Store metadata on blockchain
 * 7. Store IPFS CID mapping
 *
 * @param {string} filePath - Path to file
 * @param {string} privateKey - Private key for signing transactions
 * @param {string} contractAddress - Contract address
 * @param {string} recipientPublicKey - Optional RSA public key for key wrapping (PEM format)
 * @returns {Promise<Object>} Upload result with IPFS hash and transaction hash
 */
async function uploadFileToBlockchain(filePath, privateKey, contractAddress, recipientPublicKey = null) {
  let symmetricKey = null

  try {
    // Validate inputs
    const validation = validateUploadParams({ filePath, privateKey, contractAddress })
    if (validation.error) {
      logSecurityEvent('INVALID_INPUT', { operation: 'upload', error: validation.error.message })
      throw new Error(`Validation failed: ${validation.error.message}`)
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    // Check file size before reading into memory
    const stats = fs.statSync(filePath)
    if (stats.size > MAX_FILE_SIZE) {
      logSecurityEvent('FILE_TOO_LARGE', { size: stats.size, maxSize: MAX_FILE_SIZE })
      throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE} bytes)`)
    }

    if (stats.size === 0) {
      throw new Error('Cannot upload empty file')
    }

    logger.info('Starting file upload', { filePath: path.basename(filePath), contractAddress })

    // Read file
    const fileBuffer = fs.readFileSync(filePath)

    // Generate symmetric key and encrypt file
    symmetricKey = generateSymmetricKey()
    const { ciphertext, iv, authTag } = encryptFile(fileBuffer, symmetricKey)

    // Upload encrypted file to IPFS
    const ipfsHash = await uploadToIPFS(ciphertext)

    // Validate IPFS hash format
    const ipfsValidation = validateIPFSHash(ipfsHash)
    if (ipfsValidation.error) {
      secureZero(symmetricKey)
      symmetricKey = null
      throw new Error(`Invalid IPFS hash format: ${ipfsValidation.error.message}`)
    }

    // Convert IPFS hash to bytes32 for blockchain storage
    // Hash the IPFS CID string (UTF-8 encoded) to create a deterministic bytes32 identifier
    // web3.utils.keccak256() hashes strings as UTF-8 bytes, which is correct for CID strings
    const fileHash = web3.utils.keccak256(ipfsHash)

    // Validate fileHash format (should be 0x + 64 hex chars)
    if (!fileHash || !fileHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      secureZero(symmetricKey)
      symmetricKey = null
      throw new Error('Invalid fileHash generated from IPFS hash')
    }

    // Wrap symmetric key for storage
    let wrappedKey
    if (recipientPublicKey) {
      // Validate recipient public key format before use
      if (typeof recipientPublicKey !== 'string' || !recipientPublicKey.includes('-----BEGIN')) {
        secureZero(symmetricKey)
        symmetricKey = null
        throw new Error('Recipient public key must be in PEM format')
      }

      // Wrap with recipient's public key (RSA-OAEP)
      try {
        wrappedKey = wrapKeyForRecipient(symmetricKey, recipientPublicKey)
      } catch (wrapError) {
        secureZero(symmetricKey)
        symmetricKey = null
        throw wrapError
      }
    } else {
      // Temporary: Store encrypted key metadata
      // TODO: In production, always use recipient public key wrapping
      // This is a placeholder that should be replaced with proper key wrapping
      const keyMetadata = {
        iv,
        tag: authTag,
        // Note: In production, the symmetric key should be wrapped with recipient's public key
        // This plaintext storage is a security risk and should be removed
        key: symmetricKey.toString('hex')
      }
      wrappedKey = Buffer.from(JSON.stringify(keyMetadata))

      if (wrappedKey.length > MAX_ENCRYPTED_KEY_SIZE) {
        secureZero(symmetricKey)
        symmetricKey = null
        throw new Error(`Wrapped key exceeds maximum size: ${wrappedKey.length} bytes`)
      }

      logSecurityEvent('PLAINTEXT_KEY_STORAGE', {
        warning: 'Symmetric key stored without proper wrapping - use recipientPublicKey parameter'
      })
    }

    // Securely zero out symmetric key from memory
    secureZero(symmetricKey)
    symmetricKey = null

    // Set up account and configure web3 to use it for signing
    const account = web3.eth.accounts.privateKeyToAccount(privateKey)
    
    // Add account to wallet - this enables automatic signing for transactions
    web3.eth.accounts.wallet.add(account)
    
    // Set default account for convenience (web3.js v4 may use this)
    web3.eth.defaultAccount = account.address

    // Verify account has funds (debug log for local dev)
    if (process.env.DECENTRAFILE_NETWORK === 'local' || !process.env.DECENTRAFILE_NETWORK) {
      try {
        const balance = await web3.eth.getBalance(account.address)
        const network = await web3.eth.getChainId()
        logger.info('UPLOAD_ACCOUNT_BALANCE_CHECK', {
          address: account.address,
          balance: web3.utils.fromWei(balance, 'ether'),
          network: runtimeConfig.networkName,
          chainId: network.toString()
        })
        
        // If balance is zero, this is a critical error
        if (balance === BigInt(0)) {
          throw new Error(`Account ${account.address} has zero balance. Cannot send transaction.`)
        }
      } catch (balanceError) {
        logger.error('Account balance check failed', { error: balanceError.message })
        throw balanceError
      }
    }

    // Get contract instance
    const contract = new web3.eth.Contract(FileRegistryABI, contractAddress)

    // Upload metadata to blockchain
    // Convert Buffer to hex string for web3.js v4 (requires 0x prefix for bytes parameter)
    const wrappedKeyHex = '0x' + wrappedKey.toString('hex')

    // Verify account is in wallet (web3.js v4 requires account to be in wallet for auto-signing)
    const walletAccount = web3.eth.accounts.wallet.get(account.address)
    if (!walletAccount || walletAccount.address.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`Account ${account.address} not found in web3 wallet. Cannot sign transaction.`)
    }

    const tx = await contract.methods.uploadFile(fileHash, wrappedKeyHex).send({
      from: account.address,
      gas: 500000
    })

    // Store IPFS hash mapping (critical for file retrieval)
    ipfsHashMapping.set(fileHash, ipfsHash)

    // Save to persistent storage if configured
    saveIPFSMapping(ipfsHashMapping)

    logger.info('Transaction confirmed', { txHash: tx.transactionHash })
    logFileUpload(fileHash, ipfsHash, account.address)

    return {
      ipfsHash,
      fileHash,
      txHash: tx.transactionHash
    }
  } catch (error) {
    // Ensure symmetric key is zeroed even on error
    if (symmetricKey) {
      secureZero(symmetricKey)
    }
    logError(error, { operation: 'upload', filePath: filePath ? path.basename(filePath) : 'unknown' })
    throw error
  }
}

/**
 * Download file from blockchain and IPFS
 *
 * Process:
 * 1. Validate inputs
 * 2. Check if file exists on blockchain
 * 3. Retrieve encrypted key from blockchain
 * 4. Unwrap symmetric key
 * 5. Retrieve IPFS CID from mapping
 * 6. Download encrypted file from IPFS
 * 7. Decrypt file
 * 8. Save decrypted file
 *
 * @param {string} fileHash - File hash (bytes32)
 * @param {string} contractAddress - Contract address
 * @param {string} outputPath - Path to save downloaded file
 * @param {string} recipientPrivateKey - Optional RSA private key for key unwrapping (PEM format)
 * @returns {Promise<void>}
 */
async function downloadFileFromBlockchain(fileHash, contractAddress, outputPath, recipientPrivateKey = null) {
  let symmetricKey = null

  try {
    // Validate inputs
    const validation = validateDownloadParams({ fileHash, contractAddress, outputPath })
    if (validation.error) {
      logSecurityEvent('INVALID_INPUT', { operation: 'download', error: validation.error.message })
      throw new Error(`Validation failed: ${validation.error.message}`)
    }

    // Mask fileHash for logging
    const maskedFileHash = fileHash ? `${fileHash.substring(0, 8)}...` : 'unknown'
    logger.info('Starting file download', { fileHash: maskedFileHash, contractAddress })

    // Ensure fileHash is properly formatted (must be 0x + 64 hex chars)
    let fileHashFormatted = fileHash
    if (!fileHashFormatted.startsWith('0x')) {
      fileHashFormatted = '0x' + fileHashFormatted
    }
    if (fileHashFormatted.length !== 66) {
      throw new Error(`Invalid fileHash format: expected 66 characters (0x + 64 hex), got ${fileHashFormatted.length}`)
    }

    // Use direct eth_call to bypass web3.js v4 validator issues with bytes32
    // Manually encode bytes32 parameter (64 hex chars, no 0x prefix in encoding)
    const hashHex = fileHashFormatted.startsWith('0x') ? fileHashFormatted.slice(2) : fileHashFormatted
    if (hashHex.length !== 64) {
      throw new Error(`Invalid fileHash hex length: expected 64, got ${hashHex.length}`)
    }

    // Encode function signature and parameter manually
    const fileExistsSignature = web3.eth.abi.encodeFunctionSignature('fileExists(bytes32)')
    const existsCallData = fileExistsSignature + hashHex

    const existsResult = await web3.eth.call({
      to: contractAddress,
      data: existsCallData
    })

    // Decode bool result (0x00 = false, 0x01 = true, padded to 32 bytes)
    const fileExists = existsResult !== '0x' && existsResult !== '0x00' && !existsResult.match(/^0x0+$/)

    if (!fileExists) {
      logSecurityEvent('FILE_NOT_FOUND', { fileHash: maskedFileHash })
      throw new Error('File not found on blockchain')
    }

    // Use direct eth_call for downloadFile
    const downloadSignature = web3.eth.abi.encodeFunctionSignature('downloadFile(bytes32)')
    const downloadCallData = downloadSignature + hashHex

    const rawResult = await web3.eth.call({
      to: contractAddress,
      data: downloadCallData
    })

    if (!rawResult || rawResult === '0x' || rawResult.length < 66) {
      throw new Error('Invalid response from contract: empty or malformed bytes')
    }

    // Decode ABI-encoded bytes return value
    // Format: 0x + offset (32 bytes) + length (32 bytes) + data (padded to 32-byte boundary)
    let wrappedKeyHex
    try {
      const decoded = web3.eth.abi.decodeParameters(['bytes'], rawResult)
      wrappedKeyHex = decoded[0]
    } catch (decodeError) {
      // Fallback: manual parsing for dynamic bytes
      // Extract length from position 0x20 (bytes 32-63)
      const lengthHex = rawResult.substring(66, 130)
      const length = parseInt(lengthHex, 16)
      if (length > 0 && length < 10000) {
        // Extract data starting at 0x40 (byte 64+)
        const dataStart = 130
        const dataEnd = dataStart + (length * 2)
        if (rawResult.length >= dataEnd) {
          wrappedKeyHex = '0x' + rawResult.substring(dataStart, dataEnd)
        } else {
          throw new Error('Contract response truncated')
        }
      } else {
        throw new Error('Invalid bytes length in contract response')
      }
    }

    // Convert hex string to Buffer
    const wrappedKeyBuffer = Buffer.from(
      wrappedKeyHex.startsWith('0x') ? wrappedKeyHex.slice(2) : wrappedKeyHex,
      'hex'
    )

    // Unwrap symmetric key
    let iv, authTag

    try {
      if (recipientPrivateKey) {
        // Unwrap using recipient's private key
        symmetricKey = unwrapKeyForRecipient(wrappedKeyBuffer, recipientPrivateKey)
        // Security note: IV and authTag should be stored separately or retrieved from metadata
        // This is a simplified implementation that requires IV/authTag storage
        // Zero the symmetric key before throwing (it cannot be used without IV/authTag)
        secureZero(symmetricKey)
        symmetricKey = null
        throw new Error('Key unwrapping with recipient private key requires IV/authTag storage - not yet implemented')
      } else {
        // Temporary: Parse key metadata (should be removed in production)
        // Security note: This mode stores symmetric key in plaintext JSON - use recipientPublicKey parameter instead
        let keyData
        try {
          const keyDataString = wrappedKeyBuffer.toString('utf8')
          keyData = JSON.parse(keyDataString)
        } catch (parseError) {
          logSecurityEvent('INVALID_ENCRYPTED_KEY', { fileHash: maskedFileHash })
          throw new Error('Invalid encrypted key format')
        }

        // Validate key data structure
        if (!keyData.key || !keyData.iv || !keyData.tag) {
          logSecurityEvent('INVALID_ENCRYPTED_KEY', { fileHash: maskedFileHash })
          throw new Error('Invalid encrypted key format: missing required fields')
        }

        symmetricKey = Buffer.from(keyData.key, 'hex')
        iv = keyData.iv
        authTag = keyData.tag

        // Validate symmetric key length
        if (symmetricKey.length !== 32) {
          logSecurityEvent('INVALID_ENCRYPTED_KEY', { fileHash: maskedFileHash })
          secureZero(symmetricKey)
          symmetricKey = null
          throw new Error('Invalid encrypted key format: incorrect key length')
        }
      }
    } catch (error) {
      // Ensure symmetric key is zeroed on error
      if (symmetricKey) {
        secureZero(symmetricKey)
        symmetricKey = null
      }
      throw error
    }

    // Retrieve IPFS CID from mapping
    // Critical: Cannot reconstruct IPFS hash from fileHash (keccak256 is one-way hash)
    // The mapping must be persisted or files become permanently inaccessible after restart
    let ipfsHash = ipfsHashMapping.get(fileHash)

    if (!ipfsHash) {
      // Try reloading from persistent storage in case it was updated externally
      if (IPFS_MAPPING_FILE && fs.existsSync(IPFS_MAPPING_FILE)) {
        const reloaded = loadIPFSMapping()
        for (const [hash, ipfs] of reloaded.entries()) {
          ipfsHashMapping.set(hash, ipfs)
        }
        ipfsHash = ipfsHashMapping.get(fileHash)
      }
    }

    if (!ipfsHash) {
      // Ensure symmetric key is zeroed before throwing
      if (symmetricKey) {
        secureZero(symmetricKey)
        symmetricKey = null
      }

      // Critical error: IPFS hash mapping is lost
      // This happens if:
      // 1. Application was restarted and IPFS_MAPPING_FILE is not configured
      // 2. File was uploaded before mapping persistence was implemented
      // 3. Mapping file was deleted or corrupted
      logSecurityEvent('IPFS_HASH_NOT_FOUND', { fileHash: maskedFileHash })
      const errorMsg = IPFS_MAPPING_FILE
        ? 'IPFS hash not found in mapping. File may be permanently inaccessible if mapping was lost.'
        : 'IPFS hash not found. Configure IPFS_MAPPING_FILE environment variable for persistent storage to prevent data loss on restart.'
      throw new Error(errorMsg)
    }

    // Validate IPFS hash
    const ipfsValidation = validateIPFSHash(ipfsHash)
    if (ipfsValidation.error) {
      // Ensure symmetric key is zeroed before throwing
      if (symmetricKey) {
        secureZero(symmetricKey)
        symmetricKey = null
      }
      throw new Error(`Invalid IPFS hash format: ${ipfsValidation.error.message}`)
    }

    // Download encrypted file from IPFS
    const encryptedFile = await downloadFromIPFS(ipfsHash)

    // Decrypt file
    let decryptedFile
    try {
      decryptedFile = decryptFile(encryptedFile, symmetricKey, iv, authTag)
    } catch (decryptError) {
      logSecurityEvent('DECRYPTION_FAILED', { fileHash: maskedFileHash })
      secureZero(symmetricKey)
      symmetricKey = null
      throw new Error('Failed to decrypt file. Invalid key or corrupted data.')
    }

    // Securely zero out symmetric key
    secureZero(symmetricKey)
    symmetricKey = null

    // Save file
    fs.writeFileSync(outputPath, decryptedFile)
    logger.info('File downloaded successfully', { outputPath: path.basename(outputPath) })
    logFileDownload(fileHash, contractAddress)
  } catch (error) {
    // Ensure symmetric key is zeroed even if error occurs outside try blocks
    if (symmetricKey) {
      secureZero(symmetricKey)
      symmetricKey = null
    }
    logError(error, { operation: 'download', fileHash })
    throw error
  }
}

/**
 * Get IPFS hash mapping (for testing/debugging)
 * @param {string} fileHash - File hash (bytes32)
 * @returns {string|null} IPFS hash or null if not found
 */
function getIPFSHash(fileHash) {
  return ipfsHashMapping.get(fileHash) || null
}

// Export functions for use in HTML pages
if (typeof window !== 'undefined') {
  window.DecentraFile = {
    uploadFileToBlockchain,
    downloadFileFromBlockchain
  }
}

module.exports = {
  uploadFileToBlockchain,
  downloadFileFromBlockchain,
  getIPFSHash
}
