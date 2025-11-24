/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { logger, logError, logSecurityEvent } = require('./utils/logger')
const { uploadFileToBlockchain, downloadFileFromBlockchain } = require('./index')
const { getFileRegistryAddress } = require('./config/deploymentInfo')

const app = express()
const PORT = process.env.PORT || 3000

function getContractAddress() {
  try {
    return getFileRegistryAddress()
  } catch (error) {
    // Fallback to legacy file-based approach for backward compatibility
    const contractAddressFile = '/app/data/contract-address.txt'
    if (fs.existsSync(contractAddressFile)) {
      const address = fs.readFileSync(contractAddressFile, 'utf8').trim()
      if (address) {
        logger.warn('Using legacy contract address file. Consider using deployment artifacts.')
        return address
      }
    }
    throw new Error('Contract address not found. Run deployment script or set CONTRACT_ADDRESS.')
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
})

app.use(express.json())
app.use(express.static(path.join(__dirname)))
app.use('/assets', express.static(path.join(__dirname, '../assets')))

app.get('/', (req, res) => {
  res.redirect('/upload.html')
})

app.get('/upload.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'))
})

app.get('/download.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'download.html'))
})

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now()
  logger.info('PORTAL_UPLOAD_STARTED', {
    event: 'PORTAL_UPLOAD_STARTED',
    actor: 'sender',
    timestamp: new Date().toISOString(),
    fileSize: req.file ? req.file.size : 0
  })

  try {
    if (!req.file) {
      logSecurityEvent('INVALID_INPUT', { operation: 'upload', error: 'No file provided' })
      return res.status(400).json({ error: 'No file provided' })
    }

    if (req.file.size === 0) {
      logSecurityEvent('INVALID_INPUT', { operation: 'upload', error: 'Empty file not allowed' })
      return res.status(400).json({ error: 'Empty file not allowed' })
    }

    const contractAddress = getContractAddress()

    const tempDir = path.join(__dirname, '../data/temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const tempFilePath = path.join(tempDir, `upload-${Date.now()}-${req.file.originalname}`)
    fs.writeFileSync(tempFilePath, req.file.buffer)

    // Use Hardhat default account #0 private key for local testing (well-known, safe for local dev only)
    // In production, use environment variable: process.env.PRIVATE_KEY
    const senderPrivateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

    // Debug: Verify account balance for local dev
    if (process.env.DECENTRAFILE_NETWORK === 'local' || !process.env.DECENTRAFILE_NETWORK) {
      try {
        const { ethers: ethersLib } = require('hardhat')
        const provider = new ethersLib.JsonRpcProvider(process.env.RPC_URL || 'http://hardhat:8545')
        const wallet = new ethersLib.Wallet(senderPrivateKey, provider)
        const balance = await provider.getBalance(wallet.address)
        logger.info('PORTAL_UPLOAD_ACCOUNT_CHECK', {
          address: wallet.address,
          balance: ethersLib.formatEther(balance),
          network: process.env.DECENTRAFILE_NETWORK || 'local'
        })
      } catch (balanceError) {
        logger.warn('Could not check account balance', { error: balanceError.message })
      }
    }

    const result = await uploadFileToBlockchain(
      tempFilePath,
      senderPrivateKey,
      contractAddress
    )

    fs.unlinkSync(tempFilePath)

    const duration = Date.now() - startTime
    logger.info('PORTAL_UPLOAD_SUCCESS', {
      event: 'PORTAL_UPLOAD_SUCCESS',
      actor: 'sender',
      fileHash: result.fileHash ? `${result.fileHash.substring(0, 8)}...` : 'unknown',
      cidMasked: result.ipfsHash ? `${result.ipfsHash.substring(0, 8)}...` : 'unknown',
      timestamp: new Date().toISOString(),
      duration
    })

    res.json({
      success: true,
      fileHash: result.fileHash,
      ipfsHash: result.ipfsHash,
      txHash: result.txHash
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('PORTAL_UPLOAD_FAILURE', {
      event: 'PORTAL_UPLOAD_FAILURE',
      actor: 'sender',
      error: error.message,
      timestamp: new Date().toISOString(),
      duration
    })
    logError(error, { operation: 'portal_upload' })
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/download', async (req, res) => {
  const startTime = Date.now()
  const { fileHash } = req.body

  const trimmedHash = fileHash ? fileHash.trim() : null
  logger.info('PORTAL_DOWNLOAD_STARTED', {
    event: 'PORTAL_DOWNLOAD_STARTED',
    actor: 'receiver',
    fileHash: trimmedHash ? `${trimmedHash.substring(0, 8)}...` : 'unknown',
    timestamp: new Date().toISOString()
  })

  try {
    if (!trimmedHash || trimmedHash.length === 0) {
      logSecurityEvent('INVALID_INPUT', { operation: 'download', error: 'No fileHash provided' })
      return res.status(400).json({ error: 'No fileHash provided' })
    }

    const tempDir = path.join(__dirname, '../data/temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const contractAddress = getContractAddress()
    const outputPath = path.join(tempDir, `download-${Date.now()}.bin`)

    await downloadFileFromBlockchain(
      trimmedHash,
      contractAddress,
      outputPath
    )

    const fileBuffer = fs.readFileSync(outputPath)
    fs.unlinkSync(outputPath)

    const duration = Date.now() - startTime
    logger.info('PORTAL_DOWNLOAD_SUCCESS', {
      event: 'PORTAL_DOWNLOAD_SUCCESS',
      actor: 'receiver',
      fileHash: trimmedHash ? `${trimmedHash.substring(0, 8)}...` : 'unknown',
      fileSize: fileBuffer.length,
      timestamp: new Date().toISOString(),
      duration
    })

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="downloaded-${trimmedHash.substring(0, 8)}.bin"`)
    res.send(fileBuffer)
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('PORTAL_DOWNLOAD_FAILURE', {
      event: 'PORTAL_DOWNLOAD_FAILURE',
      actor: 'receiver',
      fileHash: trimmedHash ? `${trimmedHash.substring(0, 8)}...` : 'unknown',
      error: error.message,
      timestamp: new Date().toISOString(),
      duration
    })
    logError(error, { operation: 'portal_download' })
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  try {
    const contractAddress = getContractAddress()
    logger.info('HTTP server started', { port: PORT, contractAddress })
  } catch (error) {
    logger.warn('HTTP server started but contract address not yet available', { port: PORT })
  }
})

