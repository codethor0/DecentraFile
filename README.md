# DecentraFile

A free, secure, decentralized file transfer protocol using blockchain and IPFS. DecentraFile enables users to upload, store, and share files in a decentralized manner while maintaining privacy and security through encryption.

## Features

- **End-to-End Encryption**: Files are encrypted using AES-256-GCM before upload
- **Decentralized Storage**: Files are stored on IPFS (InterPlanetary File System)
- **Blockchain Registry**: File metadata and access keys are stored on the blockchain
- **Secure Key Management**: Encrypted keys stored on-chain, accessible only to authorized users
- **Modern UI**: Beautiful, responsive web interface for upload and download

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       ├───► Encrypt File (AES-256)
       │
       ├───► Upload to IPFS
       │         │
       │         └───► IPFS Network
       │
       └───► Store Metadata on Blockchain
                 │
                 └───► Ethereum/Polygon Network
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MetaMask or another Web3 wallet
- Access to an IPFS node (Infura, Pinata, or local node)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/codethor0/DecentraFile.git
cd DecentraFile
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your:
- Private key (for deploying contracts)
- RPC URL (for blockchain connection)
- IPFS configuration

## Networks

DecentraFile supports multiple network configurations:

### Local Development (Default)

- **Network**: `local` (Hardhat)
- **Storage**: `mock` (in-memory IPFS mock)
- **Use Case**: Development and testing

Default configuration requires no environment variables. The system automatically uses Hardhat local network and mock IPFS.

### Testnet

- **Network**: `testnet` (e.g., Polygon Mumbai)
- **Storage**: `ipfs` (real IPFS endpoint)
- **Use Case**: Testing on public testnets

Required environment variables:
- `DECENTRAFILE_NETWORK=testnet`
- `RPC_URL=<testnet RPC endpoint>`
- `IPFS_ENDPOINT=<IPFS HTTP API endpoint>`
- `PRIVATE_KEY=<deployer private key>` (for deployment)

### Mainnet

- **Network**: `mainnet` (e.g., Polygon mainnet)
- **Storage**: `ipfs` (real IPFS endpoint)
- **Use Case**: Production deployment

Required environment variables:
- `DECENTRAFILE_NETWORK=mainnet`
- `RPC_URL=<mainnet RPC endpoint>`
- `IPFS_ENDPOINT=<IPFS HTTP API endpoint>`
- `PRIVATE_KEY=<deployer private key>` (for deployment)

Configuration is controlled via environment variables:
- `DECENTRAFILE_NETWORK`: `local`, `testnet`, or `mainnet`
- `DECENTRAFILE_STORAGE`: `mock` or `ipfs`
- `RPC_URL`: Blockchain RPC endpoint
- `IPFS_ENDPOINT`: IPFS HTTP API endpoint (required when `DECENTRAFILE_STORAGE=ipfs`)

## Smart Contract Development

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test
```

### Deploy Contracts

**Local:**
```bash
npm run deploy:local
```

**Testnet:**
```bash
DECENTRAFILE_NETWORK=testnet RPC_URL=<rpc_url> PRIVATE_KEY=<key> npm run deploy:testnet
```

**Mainnet:**
```bash
DECENTRAFILE_NETWORK=mainnet RPC_URL=<rpc_url> PRIVATE_KEY=<key> npm run deploy:mainnet
```

Deployment artifacts are saved to `deployments/<network>.json` and automatically loaded at runtime.

## Usage

### Upload a File

Using Node.js:

```javascript
const { uploadFileToBlockchain } = require('./src/index');

await uploadFileToBlockchain(
    './path/to/file.pdf',
    process.env.PRIVATE_KEY,
    process.env.CONTRACT_ADDRESS
);
```

### Download a File

Using Node.js:

```javascript
const { downloadFileFromBlockchain } = require('./src/index');

await downloadFileFromBlockchain(
    '0x...', // file hash
    process.env.CONTRACT_ADDRESS,
    './downloaded-file.pdf'
);
```

### Web Interface

1. Open `src/upload.html` in a browser to upload files
2. Open `src/download.html` in a browser to download files

**Note**: The web interface currently requires backend integration. Use the Node.js scripts for full functionality.

## Project Structure

```
DecentraFile/
├── contracts/
│   └── FileRegistry.sol      # Smart contract for file registry
├── scripts/
│   └── deploy.js              # Deployment script
├── test/
│   └── FileRegistry.test.js   # Smart contract tests
├── src/
│   ├── index.js               # Main blockchain interaction logic
│   ├── ipfs.js                # IPFS client wrapper
│   ├── upload.html            # Upload portal UI
│   └── download.html          # Download portal UI
├── .env.example               # Environment variables template
├── hardhat.config.js          # Hardhat configuration
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## Smart Contract API

### `uploadFile(bytes32 fileHash, bytes encryptedKey)`
Uploads file metadata to the blockchain.

**Parameters:**
- `fileHash`: Keccak256 hash of the IPFS CID
- `encryptedKey`: Encrypted AES key (JSON stringified)

**Events:**
- `FileUploaded(bytes32 indexed fileHash, address indexed owner, uint256 timestamp)`

### `downloadFile(bytes32 fileHash) returns (bytes)`
Retrieves the encrypted key for a file.

**Parameters:**
- `fileHash`: Keccak256 hash of the IPFS CID

**Returns:**
- Encrypted key data

**Events:**
- `FileDownloaded(bytes32 indexed fileHash, address indexed recipient)`

### `getFileMetadata(bytes32 fileHash) returns (bytes32, address, uint256)`
Gets file metadata.

**Returns:**
- File hash
- Owner address
- Upload timestamp

### `getUserFiles(address user) returns (bytes32[])`
Gets all file hashes uploaded by a user.

## Security

DecentraFile implements comprehensive security measures:

### Security Features

- **Input Validation**: All inputs are validated using Joi schemas
- **Error Handling**: Comprehensive error handling with custom errors
- **Logging & Monitoring**: Structured logging with Winston
- **Static Analysis**: ESLint and Solhint for code quality
- **Automated Testing**: Comprehensive test suite with edge cases
- **CI/CD**: Automated security checks in GitHub Actions
- **Dependency Management**: Dependabot for automated dependency updates

### Security Audit

Run security checks:

```bash
npm run security:audit
```

This will run:
- npm audit for dependency vulnerabilities
- ESLint for JavaScript code quality
- Solhint for Solidity code quality
- Test coverage analysis

### Security Considerations

- **Private Keys**: Never commit private keys to version control
- **Key Management**: In production, implement proper key encryption with recipient public keys
- **IPFS Pinning**: Ensure files are pinned to prevent garbage collection
- **Access Control**: Consider implementing access control mechanisms for file sharing
- **Rate Limiting**: Implement rate limiting for production deployments

See [SECURITY.md](SECURITY.md) for detailed security information and vulnerability reporting.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Run tests and linting: `npm test && npm run lint`
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Roadmap

- [ ] Implement recipient-based key encryption (RSA)
- [ ] Add file sharing permissions
- [ ] Create backend API for web interface
- [ ] Add file versioning support
- [ ] Implement file deletion/revocation
- [ ] Create mobile app
- [ ] Add file preview functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Hardhat](https://hardhat.org/)
- Uses [IPFS](https://ipfs.io/) for decentralized storage
- Powered by [Ethereum](https://ethereum.org/) / [Polygon](https://polygon.technology/)

## Support

For issues and questions, please open an issue on GitHub.

## Security

Please read [SECURITY.md](SECURITY.md) for details on our security policy and vulnerability reporting.

---

Made by [codethor0](https://github.com/codethor0)

---

Maintainer: Thor Thor  
Email: codethor@gmail.com  
LinkedIn: https://www.linkedin.com/in/thor-thor0

