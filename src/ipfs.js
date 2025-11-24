/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const { logger, logError } = require('./utils/logger')
const { getRuntimeConfig } = require('./config/runtimeConfig')

let ipfs = null

try {
  const runtimeConfig = getRuntimeConfig()

  if (runtimeConfig.storageMode === 'mock') {
    // Use mock IPFS for local testing
    const MockIPFSClient = require('../test/utils/ipfs-mock')
    const mockIPFS = new MockIPFSClient()
    ipfs = {
      add: async (file) => {
        return await mockIPFS.add(file)
      },
      cat: async function * (hash) {
        yield * mockIPFS.cat(hash)
      },
      pin: {
        add: async (hash) => {
          const pin = await mockIPFS.pin()
          return await pin.add(hash)
        }
      }
    }
    logger.info('Using mock IPFS client', { service: 'ipfs' })
  } else {
    // Use real IPFS client
    const { create } = require('ipfs-http-client')
    if (!runtimeConfig.ipfsEndpoint) {
      throw new Error('IPFS_ENDPOINT is required when DECENTRAFILE_STORAGE=ipfs')
    }
    ipfs = create({
      url: runtimeConfig.ipfsEndpoint,
      headers: {
        authorization: process.env.IPFS_AUTH ? `Basic ${process.env.IPFS_AUTH}` : undefined
      }
    })
    logger.info('Using real IPFS client', { service: 'ipfs', endpoint: runtimeConfig.ipfsEndpoint.substring(0, 30) + '...' })
  }
} catch (error) {
  // Fallback to legacy USE_MOCK_IPFS for backward compatibility (deprecated)
  if (process.env.USE_MOCK_IPFS === 'true') {
    const MockIPFSClient = require('../test/utils/ipfs-mock')
    const mockIPFS = new MockIPFSClient()
    ipfs = {
      add: async (file) => {
        return await mockIPFS.add(file)
      },
      cat: async function * (hash) {
        yield * mockIPFS.cat(hash)
      },
      pin: {
        add: async (hash) => {
          const pin = await mockIPFS.pin()
          return await pin.add(hash)
        }
      }
    }
    logger.info('Using mock IPFS client (legacy mode)', { service: 'ipfs' })
  } else {
    const { create } = require('ipfs-http-client')
    ipfs = create({
      url: process.env.IPFS_URL || 'https://ipfs.infura.io:5001/api/v0',
      headers: {
        authorization: process.env.IPFS_AUTH ? `Basic ${process.env.IPFS_AUTH}` : undefined
      }
    })
    logger.info('Using real IPFS client (legacy mode)', { service: 'ipfs' })
  }
}

/**
 * Upload a file to IPFS
 * @param {Buffer|File} file - The file to upload
 * @returns {Promise<string>} IPFS hash (CID)
 */
async function uploadFile(file, timeoutMs = 30000) {
  if (!Buffer.isBuffer(file) && !(file instanceof Uint8Array)) {
    throw new Error('File must be a Buffer or Uint8Array')
  }

  let timeoutHandle = null
  try {
    // Create a timeout promise with cleanup
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('IPFS upload timeout')), timeoutMs)
    })

    // Race between IPFS upload and timeout
    const uploadPromise = ipfs.add(file)
    const result = await Promise.race([uploadPromise, timeoutPromise])

    // Clear timeout if upload completed successfully
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    const cid = result.cid.toString()
    logger.debug('File uploaded to IPFS', { cidLength: cid.length })
    return cid
  } catch (error) {
    // Clear timeout on error
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    logError(error, { operation: 'ipfs_upload' })
    if (error.message === 'IPFS upload timeout') {
      throw new Error('IPFS upload timed out. The IPFS node may be unresponsive.')
    }
    throw new Error(`IPFS upload failed: ${error.message}`)
  }
}

/**
 * Download a file from IPFS
 * @param {string} hash - IPFS hash (CID)
 * @returns {Promise<Buffer>} File content
 */
async function downloadFile(hash, timeoutMs = 60000) {
  if (!hash || typeof hash !== 'string') {
    throw new Error('IPFS hash must be a non-empty string')
  }

  let timeoutHandle = null
  try {
    // Create a timeout promise with cleanup
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('IPFS download timeout')), timeoutMs)
    })

    // Race between IPFS download and timeout
    const downloadPromise = (async () => {
      const chunks = []
      for await (const chunk of ipfs.cat(hash)) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    })()

    const fileBuffer = await Promise.race([downloadPromise, timeoutPromise])

    // Clear timeout if download completed successfully
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    logger.debug('File downloaded from IPFS', { hashLength: hash.length, fileSize: fileBuffer.length })
    return fileBuffer
  } catch (error) {
    // Clear timeout on error
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    logError(error, { operation: 'ipfs_download', hashLength: hash ? hash.length : 0 })
    if (error.message === 'IPFS download timeout') {
      throw new Error('IPFS download timed out. The IPFS node may be unresponsive or the file may not be available.')
    }
    throw new Error(`IPFS download failed: ${error.message}`)
  }
}

/**
 * Pin a file to IPFS
 * @param {string} hash - IPFS hash (CID)
 * @returns {Promise<void>}
 */
async function pinFile(hash) {
  if (!hash || typeof hash !== 'string') {
    throw new Error('IPFS hash must be a non-empty string')
  }

  try {
    await ipfs.pin.add(hash)
    logger.info('File pinned to IPFS', { hashLength: hash.length })
  } catch (error) {
    logError(error, { operation: 'ipfs_pin', hashLength: hash.length })
    throw new Error(`IPFS pin failed: ${error.message}`)
  }
}

module.exports = {
  uploadFile,
  downloadFile,
  pinFile,
  ipfs
}

