/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * File metadata storage utility
 * Stores filename and MIME type mappings for fileHash
 * Uses same persistent storage pattern as IPFS mapping
 */

const fs = require('fs')
const path = require('path')
const { logger, logError } = require('./logger')

const FILENAME_MAPPING_FILE = process.env.FILENAME_MAPPING_FILE || (process.env.IPFS_MAPPING_FILE ? path.join(path.dirname(process.env.IPFS_MAPPING_FILE), 'filename-mapping.json') : null)

/**
 * Load filename metadata mapping from persistent storage
 * @returns {Map} Map of fileHash to {filename, mimeType, size}
 */
function loadFilenameMapping() {
  const mapping = new Map()
  if (FILENAME_MAPPING_FILE && fs.existsSync(FILENAME_MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(FILENAME_MAPPING_FILE, 'utf8')

      if (!data || data.trim().length === 0) {
        logger.warn('Filename mapping file is empty, using empty mapping')
        return mapping
      }

      const parsed = JSON.parse(data)

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Invalid filename mapping file format: expected object')
      }

      let validEntries = 0
      let invalidEntries = 0
      for (const [fileHash, metadata] of Object.entries(parsed)) {
        if (typeof fileHash === 'string' && fileHash.length > 0 &&
            typeof metadata === 'object' && metadata !== null &&
            typeof metadata.filename === 'string' && metadata.filename.length > 0) {
          mapping.set(fileHash, {
            filename: metadata.filename,
            mimeType: metadata.mimeType || 'application/octet-stream',
            size: metadata.size || 0
          })
          validEntries++
        } else {
          invalidEntries++
        }
      }

      if (invalidEntries > 0) {
        logger.warn(`Skipped ${invalidEntries} invalid entries in filename mapping file`)
      }

      logger.debug('Loaded filename mapping from persistent storage', {
        count: mapping.size,
        validEntries,
        invalidEntries
      })
    } catch (error) {
      logError(error, { operation: 'load_filename_mapping' })
      logger.warn('Failed to load filename mapping, using empty mapping')

      if (fs.existsSync(FILENAME_MAPPING_FILE)) {
        const backupFile = FILENAME_MAPPING_FILE + '.corrupted.' + Date.now()
        try {
          fs.copyFileSync(FILENAME_MAPPING_FILE, backupFile)
          logger.info('Backed up corrupted filename mapping file', { backupFile })
        } catch (backupError) {
          // Ignore backup errors
        }
      }
    }
  }
  return mapping
}

/**
 * Save filename metadata mapping to persistent storage
 * Uses atomic write pattern: write to temp file, then rename
 * @param {Map} mapping - Map of fileHash to {filename, mimeType, size}
 */
function saveFilenameMapping(mapping) {
  if (FILENAME_MAPPING_FILE) {
    try {
      // Reload from disk to merge any external changes
      const diskMapping = loadFilenameMapping()
      for (const [fileHash, metadata] of diskMapping.entries()) {
        mapping.set(fileHash, metadata)
      }

      const data = {}
      for (const [fileHash, metadata] of mapping.entries()) {
        data[fileHash] = {
          filename: metadata.filename,
          mimeType: metadata.mimeType || 'application/octet-stream',
          size: metadata.size || 0
        }
      }

      const jsonData = JSON.stringify(data, null, 2)

      // Atomic write: write to temp file first, then rename
      const tempFile = FILENAME_MAPPING_FILE + '.tmp'
      fs.writeFileSync(tempFile, jsonData, 'utf8')
      fs.renameSync(tempFile, FILENAME_MAPPING_FILE)

      logger.debug('Saved filename mapping to persistent storage', { count: mapping.size })
    } catch (error) {
      logError(error, { operation: 'save_filename_mapping' })
      logger.warn('Failed to save filename mapping, continuing with in-memory only')

      const tempFile = FILENAME_MAPPING_FILE + '.tmp'
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

/**
 * Get filename metadata for a fileHash
 * @param {string} fileHash - File hash (bytes32)
 * @returns {Object|null} {filename, mimeType, size} or null if not found
 */
function getFilenameMetadata(fileHash) {
  const mapping = loadFilenameMapping()
  return mapping.get(fileHash) || null
}

/**
 * Set filename metadata for a fileHash
 * @param {string} fileHash - File hash (bytes32)
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @param {number} size - File size in bytes
 */
function setFilenameMetadata(fileHash, filename, mimeType, size) {
  const mapping = loadFilenameMapping()
  mapping.set(fileHash, {
    filename,
    mimeType: mimeType || 'application/octet-stream',
    size: size || 0
  })
  saveFilenameMapping(mapping)
}

module.exports = {
  loadFilenameMapping,
  saveFilenameMapping,
  getFilenameMetadata,
  setFilenameMetadata,
  FILENAME_MAPPING_FILE
}

