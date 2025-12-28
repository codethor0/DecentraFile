#!/usr/bin/env node

/*
 * Project: DecentraFile
 * Hygiene Check Script
 * Scans tracked text files for emojis and prompt/doctrine keywords
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Binary file extensions to skip
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.mp3', '.avi', '.mov',
  '.db', '.sqlite', '.sqlite3'
])

// Prompt/doctrine keywords to detect
const PROMPT_KEYWORDS = [
  'UNIVERSAL MASTER PROMPT',
  'Doctrine acknowledged',
  'ZERO-DEVIATION',
  'Implementation Agent',
  'Cursor Implementation Agent',
  'master prompt',
  'agent report',
  'verification script',
  'pretend you are talking',
  'RUNTIME TRUTH ONLY'
]

// Emoji regex (common emoji ranges)
const EMOJI_REGEX = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u

function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return BINARY_EXTENSIONS.has(ext) || filePath.includes('node_modules') || filePath.includes('.git')
}

function isTextFile(filePath) {
  // Skip lockfiles and other known binary-like files
  if (filePath.endsWith('.lock') || filePath.endsWith('.log')) {
    return false
  }
  // Skip the hygiene check script itself (it contains the keywords it checks for)
  if (filePath === 'scripts/hygiene-check.js') {
    return false
  }
  return !isBinaryFile(filePath)
}

function scanFile(filePath) {
  const issues = []
  
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    
    // Check for prompt keywords
    for (const keyword of PROMPT_KEYWORDS) {
      if (content.includes(keyword)) {
        issues.push(`Prompt/doctrine keyword found: "${keyword}"`)
      }
    }
    
    // Check for emojis
    if (EMOJI_REGEX.test(content)) {
      const matches = content.match(EMOJI_REGEX)
      issues.push(`Emoji detected: ${matches ? matches[0] : 'unknown'}`)
    }
  } catch (error) {
    // Skip files that can't be read as UTF-8 (likely binary)
    if (error.code === 'ENOENT') {
      return null
    }
    // Silently skip binary files
    return null
  }
  
  return issues.length > 0 ? { file: filePath, issues } : null
}

function main() {
  console.log('Starting Hygiene Check...\n')
  
  // Get tracked files
  let trackedFiles
  try {
    trackedFiles = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n')
  } catch (error) {
    console.error('Error: Could not get tracked files. Are you in a git repository?')
    process.exit(1)
  }
  
  // Filter to text files only
  const textFiles = trackedFiles.filter(isTextFile)
  
  console.log(`Scanning ${textFiles.length} tracked text files...\n`)
  
  const violations = []
  
  for (const file of textFiles) {
    const result = scanFile(file)
    if (result) {
      violations.push(result)
    }
  }
  
  if (violations.length > 0) {
    console.log('FAIL: Hygiene violations found:\n')
    for (const violation of violations) {
      console.log(`  ${violation.file}:`)
      for (const issue of violation.issues) {
        console.log(`    - ${issue}`)
      }
      console.log()
    }
    console.log('Hygiene check FAILED')
    process.exit(1)
  }
  
  console.log('OK: No hygiene violations found in tracked text files')
  console.log('Hygiene check PASSED')
  process.exit(0)
}

main()

