/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const Joi = require('joi')

/**
 * Validation schemas for file operations
 */

const fileHashSchema = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{64}$/)
  .required()
  .messages({
    'string.pattern.base': 'File hash must be a valid 32-byte hex string (0x followed by 64 hex characters)',
    'any.required': 'File hash is required'
  })

const ipfsHashSchema = Joi.string()
  .pattern(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^[b-zB-Z][a-z0-9]{58}$/)
  .required()
  .messages({
    'string.pattern.base': 'IPFS hash must be a valid CID (Qm... or bafy...)',
    'any.required': 'IPFS hash is required'
  })

const addressSchema = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .required()
  .messages({
    'string.pattern.base': 'Address must be a valid Ethereum address',
    'any.required': 'Address is required'
  })

const privateKeySchema = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{64}$/)
  .required()
  .messages({
    'string.pattern.base': 'Private key must be a valid 32-byte hex string',
    'any.required': 'Private key is required'
  })

const encryptedKeySchema = Joi.string()
  .min(1)
  .required()
  .messages({
    'string.min': 'Encrypted key cannot be empty',
    'any.required': 'Encrypted key is required'
  })

const filePathSchema = Joi.string()
  .min(1)
  .required()
  .messages({
    'string.min': 'File path cannot be empty',
    'any.required': 'File path is required'
  })

/**
 * Validate file hash
 * @param {string} fileHash - File hash to validate
 * @returns {Object} Validation result
 */
function validateFileHash(fileHash) {
  return fileHashSchema.validate(fileHash)
}

/**
 * Validate IPFS hash
 * @param {string} ipfsHash - IPFS hash to validate
 * @returns {Object} Validation result
 */
function validateIPFSHash(ipfsHash) {
  return ipfsHashSchema.validate(ipfsHash)
}

/**
 * Validate Ethereum address
 * @param {string} address - Address to validate
 * @returns {Object} Validation result
 */
function validateAddress(address) {
  return addressSchema.validate(address)
}

/**
 * Validate private key
 * @param {string} privateKey - Private key to validate
 * @returns {Object} Validation result
 */
function validatePrivateKey(privateKey) {
  return privateKeySchema.validate(privateKey)
}

/**
 * Validate encrypted key
 * @param {string} encryptedKey - Encrypted key to validate
 * @returns {Object} Validation result
 */
function validateEncryptedKey(encryptedKey) {
  return encryptedKeySchema.validate(encryptedKey)
}

/**
 * Validate file path
 * @param {string} filePath - File path to validate
 * @returns {Object} Validation result
 */
function validateFilePath(filePath) {
  return filePathSchema.validate(filePath)
}

/**
 * Validate upload parameters
 * @param {Object} params - Upload parameters
 * @returns {Object} Validation result
 */
function validateUploadParams(params) {
  const schema = Joi.object({
    filePath: filePathSchema,
    privateKey: privateKeySchema,
    contractAddress: addressSchema
  }).required()

  return schema.validate(params)
}

/**
 * Validate download parameters
 * @param {Object} params - Download parameters
 * @returns {Object} Validation result
 */
function validateDownloadParams(params) {
  const schema = Joi.object({
    fileHash: fileHashSchema,
    contractAddress: addressSchema,
    outputPath: filePathSchema
  }).required()

  return schema.validate(params)
}

module.exports = {
  validateFileHash,
  validateIPFSHash,
  validateAddress,
  validatePrivateKey,
  validateEncryptedKey,
  validateFilePath,
  validateUploadParams,
  validateDownloadParams
}

