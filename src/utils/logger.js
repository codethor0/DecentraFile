/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const winston = require('winston')
const path = require('path')
const fs = require('fs')

// Log file size limits
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_LOG_FILES = 5

/**
 * Logger configuration for DecentraFile
 * Provides structured logging with different levels and transports
 */

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`
    }
    return msg
  })
)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'decentrafile' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: MAX_LOG_FILE_SIZE,
      maxFiles: MAX_LOG_FILES
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: MAX_LOG_FILE_SIZE,
      maxFiles: MAX_LOG_FILES
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/rejections.log')
    })
  ]
})

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

/**
 * Log file upload operation
 *
 * Privacy: Only logs operation type and partial identifiers.
 * Does not log full hashes or sensitive data.
 *
 * @param {string} fileHash - File hash (bytes32)
 * @param {string} ipfsHash - IPFS hash (CID)
 * @param {string} owner - Owner address
 */
function logFileUpload(fileHash, ipfsHash, owner) {
  // Mask sensitive data: only log first 8 chars of hashes
  const maskedFileHash = fileHash ? `${fileHash.substring(0, 8)}...` : 'unknown'
  const maskedIPFSHash = ipfsHash ? `${ipfsHash.substring(0, 8)}...` : 'unknown'
  const maskedOwner = owner ? `${owner.substring(0, 6)}...${owner.substring(38)}` : 'unknown'

  logger.info('File uploaded', {
    fileHash: maskedFileHash,
    ipfsHash: maskedIPFSHash,
    owner: maskedOwner,
    operation: 'upload'
  })
}

/**
 * Log file download operation
 *
 * Privacy: Only logs operation type and partial identifiers.
 * Does not log full hashes or sensitive data.
 *
 * @param {string} fileHash - File hash (bytes32)
 * @param {string} recipient - Recipient address or contract address
 */
function logFileDownload(fileHash, recipient) {
  // Mask sensitive data: only log first 8 chars of hash
  const maskedFileHash = fileHash ? `${fileHash.substring(0, 8)}...` : 'unknown'
  const maskedRecipient = recipient ? `${recipient.substring(0, 6)}...${recipient.substring(38)}` : 'unknown'

  logger.info('File downloaded', {
    fileHash: maskedFileHash,
    recipient: maskedRecipient,
    operation: 'download'
  })
}

/**
 * Log error with context
 *
 * Privacy: Scrubs sensitive data from error messages and context.
 * Never logs private keys, symmetric keys, or decrypted file contents.
 *
 * @param {Error} error - Error object
 * @param {Object} context - Additional context (will be scrubbed)
 */
function logError(error, context = {}) {
  // Scrub sensitive data from context
  const scrubbedContext = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      // Mask file paths, hashes, and addresses
      if (key.includes('hash') || key.includes('Hash')) {
        scrubbedContext[key] = value.length > 8 ? `${value.substring(0, 8)}...` : '***'
      } else if (key.includes('address') || key.includes('Address') || key.includes('key') || key.includes('Key')) {
        scrubbedContext[key] = '***'
      } else if (key.includes('path') || key.includes('Path')) {
        scrubbedContext[key] = value.split(path.sep).pop() // Only filename
      } else {
        scrubbedContext[key] = value
      }
    } else {
      scrubbedContext[key] = value
    }
  }

  // Scrub error message for sensitive patterns
  let errorMessage = error.message || 'Unknown error'
  errorMessage = errorMessage.replace(/0x[a-fA-F0-9]{64}/g, '0x***') // Private keys
  errorMessage = errorMessage.replace(/0x[a-fA-F0-9]{40}/g, '0x***') // Addresses

  logger.error('Operation failed', {
    error: errorMessage,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined, // Only in dev
    ...scrubbedContext
  })
}

/**
 * Log security event
 *
 * Privacy: Scrubs sensitive data from event details.
 * Never logs full hashes, private keys, or sensitive identifiers.
 *
 * @param {string} event - Security event type
 * @param {Object} details - Event details (will be scrubbed)
 */
function logSecurityEvent(event, details) {
  // Scrub sensitive data from details
  const scrubbedDetails = {}
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string') {
      // Mask hashes, addresses, and keys
      if (key.includes('hash') || key.includes('Hash')) {
        scrubbedDetails[key] = value.length > 8 ? `${value.substring(0, 8)}...` : '***'
      } else if (key.includes('address') || key.includes('Address') || key.includes('key') || key.includes('Key')) {
        scrubbedDetails[key] = '***'
      } else {
        scrubbedDetails[key] = value
      }
    } else {
      scrubbedDetails[key] = value
    }
  }

  logger.warn('Security event', {
    event,
    ...scrubbedDetails,
    timestamp: new Date().toISOString()
  })
}

module.exports = {
  logger,
  logFileUpload,
  logFileDownload,
  logError,
  logSecurityEvent
}

