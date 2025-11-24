/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Cryptographic operations module for DecentraFile
 *
 * This module provides secure, high-level cryptographic primitives for file encryption.
 * All operations use modern, audited algorithms and follow security best practices.
 *
 * Security guarantees:
 * - AES-256-GCM for symmetric encryption (authenticated encryption)
 * - Cryptographically secure random number generation
 * - Unique IV/nonce for each encryption operation
 * - Authentication tags verified on decryption
 * - No plaintext keys exposed in memory longer than necessary
 */

const crypto = require('crypto')

// Constants
const AES_KEY_SIZE = 32 // 256 bits
const AES_IV_SIZE = 16 // 128 bits
const AES_AUTH_TAG_SIZE = 16 // 128 bits (GCM authentication tag size)
const AES_ALGORITHM = 'aes-256-gcm'
const MAX_ENCRYPTED_KEY_SIZE = 1024 // Maximum size for encrypted key blob (bytes)

/**
 * Generate a cryptographically secure random symmetric key
 *
 * @returns {Buffer} A 32-byte (256-bit) random key suitable for AES-256
 * @throws {Error} If random bytes cannot be generated
 */
function generateSymmetricKey() {
  try {
    return crypto.randomBytes(AES_KEY_SIZE)
  } catch (error) {
    throw new Error(`Failed to generate symmetric key: ${error.message}`)
  }
}

/**
 * Encrypt file data using AES-256-GCM
 *
 * AES-256-GCM provides both confidentiality and authenticity:
 * - Confidentiality: File contents are encrypted
 * - Authenticity: Authentication tag prevents tampering
 *
 * Each encryption uses a unique IV to ensure semantic security.
 *
 * @param {Buffer} fileBuffer - The file data to encrypt
 * @param {Buffer} symmetricKey - The 32-byte AES key
 * @returns {Object} Object containing:
 *   - ciphertext: Buffer - Encrypted file data
 *   - iv: string - Hex-encoded initialization vector
 *   - authTag: string - Hex-encoded authentication tag
 * @throws {Error} If encryption fails or inputs are invalid
 */
function encryptFile(fileBuffer, symmetricKey) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new Error('File buffer must be a Buffer')
  }
  if (!Buffer.isBuffer(symmetricKey) || symmetricKey.length !== AES_KEY_SIZE) {
    throw new Error(`Symmetric key must be a ${AES_KEY_SIZE}-byte Buffer`)
  }
  if (fileBuffer.length === 0) {
    throw new Error('Cannot encrypt empty file')
  }

  try {
    // Generate unique IV for this encryption
    const iv = crypto.randomBytes(AES_IV_SIZE)

    // Create cipher with GCM mode (provides authentication)
    const cipher = crypto.createCipheriv(AES_ALGORITHM, symmetricKey, iv)

    // Encrypt the file
    let ciphertext = cipher.update(fileBuffer)
    ciphertext = Buffer.concat([ciphertext, cipher.final()])

    // Get authentication tag (prevents tampering)
    const authTag = cipher.getAuthTag()

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  } catch (error) {
    // Do not expose sensitive error details
    const errorMsg = error.message || 'Unknown error'
    if (errorMsg.includes('key') || errorMsg.includes('Key') || errorMsg.includes('buffer') || errorMsg.includes('Buffer')) {
      throw new Error('Encryption failed: Invalid input parameters')
    }
    throw new Error(`Encryption failed: ${errorMsg}`)
  }
}

/**
 * Decrypt file data using AES-256-GCM
 *
 * Verifies authentication tag before returning decrypted data.
 * This ensures both confidentiality and integrity.
 *
 * @param {Buffer} ciphertext - The encrypted file data
 * @param {Buffer} symmetricKey - The 32-byte AES key
 * @param {string} iv - Hex-encoded initialization vector
 * @param {string} authTag - Hex-encoded authentication tag
 * @returns {Buffer} Decrypted file data
 * @throws {Error} If decryption fails, authentication fails, or inputs are invalid
 */
function decryptFile(ciphertext, symmetricKey, iv, authTag) {
  if (!Buffer.isBuffer(ciphertext)) {
    throw new Error('Ciphertext must be a Buffer')
  }
  if (!Buffer.isBuffer(symmetricKey) || symmetricKey.length !== AES_KEY_SIZE) {
    throw new Error(`Symmetric key must be a ${AES_KEY_SIZE}-byte Buffer`)
  }
  if (typeof iv !== 'string' || !/^[a-fA-F0-9]+$/.test(iv)) {
    throw new Error('IV must be a hex string')
  }
  if (typeof authTag !== 'string' || !/^[a-fA-F0-9]+$/.test(authTag)) {
    throw new Error('Auth tag must be a hex string')
  }
  if (ciphertext.length === 0) {
    throw new Error('Cannot decrypt empty ciphertext')
  }

  try {
    // Validate IV length before conversion (hex string must be exactly 2 * AES_IV_SIZE chars)
    if (iv.length !== AES_IV_SIZE * 2) {
      throw new Error(`IV must be ${AES_IV_SIZE * 2} hex characters (${AES_IV_SIZE} bytes)`)
    }

    const ivBuffer = Buffer.from(iv, 'hex')
    if (ivBuffer.length !== AES_IV_SIZE) {
      throw new Error(`IV must be ${AES_IV_SIZE} bytes`)
    }

    // Validate auth tag length before conversion (hex string must be exactly 2 * AES_AUTH_TAG_SIZE chars)
    if (authTag.length !== AES_AUTH_TAG_SIZE * 2) {
      throw new Error(`Auth tag must be ${AES_AUTH_TAG_SIZE * 2} hex characters (${AES_AUTH_TAG_SIZE} bytes)`)
    }

    const authTagBuffer = Buffer.from(authTag, 'hex')
    if (authTagBuffer.length !== AES_AUTH_TAG_SIZE) {
      throw new Error(`Auth tag must be ${AES_AUTH_TAG_SIZE} bytes`)
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, symmetricKey, ivBuffer)

    // Set authentication tag (must be set before decryption)
    decipher.setAuthTag(authTagBuffer)

    // Decrypt and verify authentication tag
    let plaintext = decipher.update(ciphertext)
    plaintext = Buffer.concat([plaintext, decipher.final()])

    return plaintext
  } catch (error) {
    // Do not expose specific error details to prevent timing attacks
    if (error.message.includes('Unsupported state') || error.message.includes('bad decrypt')) {
      throw new Error('Decryption failed: Invalid key, corrupted data, or tampering detected')
    }
    throw new Error(`Decryption failed: ${error.message}`)
  }
}

/**
 * Wrap a symmetric key with a recipient's public key using RSA-OAEP
 *
 * This function encrypts the symmetric key so only the recipient with the
 * corresponding private key can decrypt it.
 *
 * Security notes:
 * - Uses RSA-OAEP padding with SHA-256 (PKCS#1 v2.1)
 * - Suitable for encrypting small amounts of data (keys)
 * - The wrapped key can be stored on-chain or transmitted securely
 *
 * @param {Buffer} symmetricKey - The symmetric key to wrap (32 bytes)
 * @param {string} recipientPublicKey - RSA public key in PEM format
 * @returns {Buffer} Encrypted symmetric key
 * @throws {Error} If wrapping fails or inputs are invalid
 */
function wrapKeyForRecipient(symmetricKey, recipientPublicKey) {
  if (!Buffer.isBuffer(symmetricKey) || symmetricKey.length !== AES_KEY_SIZE) {
    throw new Error(`Symmetric key must be a ${AES_KEY_SIZE}-byte Buffer`)
  }
  if (typeof recipientPublicKey !== 'string' || !recipientPublicKey.includes('-----BEGIN')) {
    throw new Error('Recipient public key must be in PEM format')
  }

  try {
    const wrappedKey = crypto.publicEncrypt(
      {
        key: recipientPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      symmetricKey
    )

    if (wrappedKey.length > MAX_ENCRYPTED_KEY_SIZE) {
      throw new Error(`Wrapped key exceeds maximum size of ${MAX_ENCRYPTED_KEY_SIZE} bytes`)
    }

    return wrappedKey
  } catch (error) {
    // Do not expose sensitive error details
    const errorMsg = error.message || 'Unknown error'
    if (errorMsg.includes('key') || errorMsg.includes('Key') || errorMsg.includes('RSA') || errorMsg.includes('public')) {
      throw new Error('Key wrapping failed: Invalid key format or parameters')
    }
    throw new Error(`Key wrapping failed: ${errorMsg}`)
  }
}

/**
 * Unwrap a symmetric key using RSA-OAEP decryption
 *
 * @param {Buffer} wrappedKey - The encrypted symmetric key
 * @param {string} recipientPrivateKey - RSA private key in PEM format
 * @returns {Buffer} Unwrapped symmetric key (32 bytes)
 * @throws {Error} If unwrapping fails or inputs are invalid
 */
function unwrapKeyForRecipient(wrappedKey, recipientPrivateKey) {
  if (!Buffer.isBuffer(wrappedKey)) {
    throw new Error('Wrapped key must be a Buffer')
  }
  if (typeof recipientPrivateKey !== 'string' || !recipientPrivateKey.includes('-----BEGIN')) {
    throw new Error('Recipient private key must be in PEM format')
  }

  try {
    const symmetricKey = crypto.privateDecrypt(
      {
        key: recipientPrivateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      wrappedKey
    )

    if (symmetricKey.length !== AES_KEY_SIZE) {
      throw new Error(`Unwrapped key must be ${AES_KEY_SIZE} bytes`)
    }

    return symmetricKey
  } catch (error) {
    // Do not expose specific error details
    throw new Error('Key unwrapping failed: Invalid key or corrupted data')
  }
}

/**
 * Securely zero out a buffer containing sensitive data
 *
 * Attempts to overwrite the buffer with zeros to reduce the chance
 * of sensitive data persisting in memory.
 *
 * Note: JavaScript's memory management may not guarantee immediate
 * overwriting, but this is a best practice.
 *
 * @param {Buffer} buffer - Buffer containing sensitive data
 */
function secureZero(buffer) {
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0)
  }
}

module.exports = {
  generateSymmetricKey,
  encryptFile,
  decryptFile,
  wrapKeyForRecipient,
  unwrapKeyForRecipient,
  secureZero,
  // Constants exported for validation
  AES_KEY_SIZE,
  AES_IV_SIZE,
  AES_AUTH_TAG_SIZE,
  MAX_ENCRYPTED_KEY_SIZE
}

