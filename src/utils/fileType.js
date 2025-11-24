/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * File type detection utility
 * Detects MIME type and file extension from file buffer content
 * Uses magic bytes (file signatures) for reliable detection
 */

const path = require('path')

/**
 * Detect MIME type and extension from file buffer
 * @param {Buffer} buffer - File buffer
 * @returns {Object} {mimeType, extension}
 */
function detectFileType(buffer) {
  if (!buffer || buffer.length === 0) {
    return { mimeType: 'application/octet-stream', extension: '.bin' }
  }

  // Check magic bytes (file signatures)
  const bytes = Array.from(buffer.slice(0, 12))

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mimeType: 'image/jpeg', extension: '.jpg' }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return { mimeType: 'image/png', extension: '.png' }
  }

  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { mimeType: 'image/gif', extension: '.gif' }
  }

  // PDF: 25 50 44 46
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimeType: 'application/pdf', extension: '.pdf' }
  }

  // ZIP: 50 4B 03 04 or 50 4B 05 06 (empty) or 50 4B 07 08 (spanned)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
      (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)) {
    return { mimeType: 'application/zip', extension: '.zip' }
  }

  // WebP: RIFF...WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return { mimeType: 'image/webp', extension: '.webp' }
  }

  // Check if it's likely text (UTF-8 or ASCII)
  if (isLikelyText(buffer)) {
    return { mimeType: 'text/plain', extension: '.txt' }
  }

  // Default fallback
  return { mimeType: 'application/octet-stream', extension: '.bin' }
}

/**
 * Check if buffer contains likely text content
 * @param {Buffer} buffer - File buffer
 * @returns {boolean}
 */
function isLikelyText(buffer) {
  if (buffer.length === 0) return false

  // Check first 512 bytes (or entire buffer if smaller)
  const sampleSize = Math.min(512, buffer.length)
  const sample = buffer.slice(0, sampleSize)

  // Count printable ASCII and common UTF-8 sequences
  let printableCount = 0
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i]
    // Printable ASCII (0x20-0x7E) or common whitespace (0x09, 0x0A, 0x0D)
    if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x09 || byte === 0x0A || byte === 0x0D) {
      printableCount++
    }
  }

  // If >80% of bytes are printable, consider it text
  return (printableCount / sampleSize) > 0.8
}

/**
 * Sanitize filename for use in Content-Disposition header
 * Removes path separators, quotes, and control characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'downloaded-file.bin'
  }

  // Remove path separators and quotes
  let sanitized = filename
    .replace(/[/\\]/g, '_') // Replace path separators
    .replace(/["']/g, '') // Remove quotes
    .replace(/[\r\n\t]/g, '_') // Replace control characters

  // Remove any remaining control characters (0x00-0x1F, 0x7F)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Ensure filename is not empty
  if (!sanitized || sanitized.trim().length === 0) {
    return 'downloaded-file.bin'
  }

  // Limit length to reasonable size (255 chars is common filesystem limit)
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized)
    const nameWithoutExt = sanitized.slice(0, 255 - ext.length)
    sanitized = nameWithoutExt + ext
  }

  return sanitized
}

module.exports = {
  detectFileType,
  isLikelyText,
  sanitizeFilename
}

