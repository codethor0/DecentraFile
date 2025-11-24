# Testing Guide

## Docker-Based E2E Testing

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20+ (for local development)

### Local Development Mode

1. Build and start the Docker stack:
```bash
npm run docker:build
npm run docker:up
```

2. Wait for services to be ready (check logs):
```bash
docker compose logs app
```

3. Run the automated E2E demo:
```bash
npm run docker:e2e
```

4. Access the web portal:
- Upload: http://localhost:3000/upload.html
- Download: http://localhost:3000/download.html

Note: Downloads preserve original filenames and extensions (e.g., .jpg, .pdf, .zip).

5. Stop the stack:
```bash
npm run docker:down
```

### Global Testnet Mode

To run DecentraFile against a public testnet:

1. Set environment variables:
```bash
export DECENTRAFILE_NETWORK=testnet
export RPC_URL=<your_testnet_rpc_url>
export IPFS_ENDPOINT=<your_ipfs_endpoint>
export CHAIN_ID=<testnet_chain_id>
```

2. Deploy contracts to testnet:
```bash
npm run deploy:testnet
```

3. Start the application:
```bash
docker compose -f docker-compose.testnet.yml up -d
```

4. Access the portal at http://localhost:3000

5. Run E2E demo:
```bash
DECENTRAFILE_NETWORK=testnet DECENTRAFILE_STORAGE=ipfs node scripts/e2e-live-demo.js
```

### E2E Demo Scripts

**Local mode (default):**
```bash
npm run e2e:local
```

**Testnet mode:**
```bash
npm run e2e:testnet
```

Note: Testnet mode requires proper environment variables (RPC_URL, IPFS_ENDPOINT) to be set.

### Manual Testing

The HTTP server provides REST API endpoints:

- `POST /api/upload`: Upload a file (multipart/form-data)
  - Returns: `{ success: true, fileHash: "...", ipfsHash: "...", txHash: "..." }`

- `POST /api/download`: Download a file (JSON body: `{ fileHash: "..." }`)
  - Returns: File binary data

### Logs

View structured logs:
```bash
docker compose logs app -f
```

Logs include:
- PORTAL_UPLOAD_STARTED/SUCCESS/FAILURE
- PORTAL_DOWNLOAD_STARTED/SUCCESS/FAILURE
- E2E_DEMO_* events

All sensitive data (keys, full hashes) are masked in logs.

# Testing Guide for DecentraFile

This document describes the testing infrastructure and how to run tests for DecentraFile.

## Test Environment Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Hardhat (installed via npm)

### Initial Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment template (if not exists):
```bash
# Create .env file from .env.example template
# Note: .env.example contains only placeholders - never commit real secrets
```

3. Configure test environment variables (optional):
```bash
# For local IPFS testing (requires IPFS daemon)
export USE_REAL_IPFS_FOR_TESTS=true
export IPFS_URL=http://127.0.0.1:5001/api/v0

# For IPFS hash mapping persistence
export IPFS_MAPPING_FILE=./test-data/ipfs-mapping.json
```

## Test Structure

### Test Files

- `test/FileRegistry.test.js` - Smart contract unit tests
- `test/crypto.test.js` - Cryptographic module unit tests
- `test/validation.test.js` - Input validation utility tests
- `test/integration.test.js` - Integration tests (blockchain + crypto + mocked IPFS)
- `test/e2e.test.js` - End-to-end file system tests
- `test/fuzz.test.js` - Fuzz and property-based tests

### Test Utilities

- `test/utils/ipfs-mock.js` - Mock IPFS client for testing
- `test/utils/test-helpers.js` - Test helper functions

## Running Tests

### All Tests

Run the complete test suite:
```bash
npm test
```

### Unit Tests Only

Run fast unit tests (contracts and crypto):
```bash
npm run test:unit
```

### Integration Tests

Run integration tests (requires Hardhat node):
```bash
npm run test:integration
```

### End-to-End Tests

Run E2E tests:
```bash
npm run test:e2e
```

### Fuzz Tests

Run fuzz/property tests (may take longer):
```bash
npm run test:fuzz
```

### Validation Tests

Run validation utility tests:
```bash
npm test -- --grep "Validation"
```

### Test Coverage

Generate coverage report:
```bash
npm run test:coverage
```

## Test Categories

### Unit Tests

**FileRegistry Contract Tests** (`test/FileRegistry.test.js`):
- Contract deployment
- File upload/download operations
- Access control
- Edge cases and error conditions
- Bounds checking

**Crypto Module Tests** (`test/crypto.test.js`):
- Key generation
- Encryption/decryption
- Key wrapping/unwrapping
- Error handling
- Input validation

**Validation Tests** (`test/validation.test.js`):
- File hash validation
- IPFS hash validation
- Ethereum address validation
- Private key validation
- Parameter validation

### Integration Tests

**Integration Tests** (`test/integration.test.js`):
- Complete upload flow (encrypt -> IPFS -> blockchain)
- Complete download flow (blockchain -> IPFS -> decrypt)
- Error handling across components
- File transfer simulation

**Note**: Integration tests use mocked IPFS by default. Set `USE_REAL_IPFS_FOR_TESTS=true` to use real IPFS daemon (requires local IPFS node).

### Fuzz Tests

**Fuzz Tests** (`test/fuzz.test.js`):
- Random data encryption/decryption
- Random contract inputs
- Boundary condition testing
- Property-based testing
- Invariant verification

## Local Development

### Starting Local Hardhat Node

Start a local Hardhat network for testing:
```bash
npm run dev:node
```

This starts a local blockchain node on `http://127.0.0.1:8545`.

### Deploying Contracts Locally

Deploy contracts to local Hardhat network:
```bash
npm run deploy:local
```

### Using Real IPFS (Optional)

1. Install IPFS:
```bash
# macOS
brew install ipfs

# Or download from https://ipfs.io/
```

2. Initialize and start IPFS daemon:
```bash
ipfs init
ipfs daemon
```

3. Run tests with real IPFS:
```bash
USE_REAL_IPFS_FOR_TESTS=true npm run test:integration
```

## Test Mocking

### IPFS Mocking

Integration tests use a mock IPFS client (`test/utils/ipfs-mock.js`) that:
- Provides deterministic behavior
- Supports failure simulation
- Supports timeout simulation
- Stores files in memory

The mock can be configured to:
- Fail on specific operations (`setFailure('upload')`)
- Simulate delays (`setUploadDelay(ms)`)
- Reset state (`reset()`)

### Example: Using IPFS Mock

```javascript
const MockIPFSClient = require('./utils/ipfs-mock')

const mockIPFS = new MockIPFSClient()

// Configure mock
mockIPFS.setFailure('upload') // Simulate upload failure

// Use mock
const result = await mockIPFS.add(data)
```

## CI/CD Testing

Tests run automatically on:
- Push to main/develop branches
- Pull requests

The CI pipeline runs:
1. Linting (ESLint + Solhint)
2. Unit tests
3. Integration tests
4. Security audit
5. Contract compilation

## Writing New Tests

### Test File Structure

```javascript
const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('Feature Name', function () {
  beforeEach(async function () {
    // Setup
  })

  afterEach(function () {
    // Cleanup
  })

  it('Should do something', async function () {
    // Test implementation
  })
})
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in `afterEach`
3. **Descriptive Names**: Use clear test descriptions
4. **Assertions**: Use specific assertions (`to.be.revertedWithCustomError`)
5. **Error Handling**: Test both success and failure paths
6. **Edge Cases**: Test boundaries and edge cases

### Example: Contract Test

```javascript
it('Should upload file successfully', async function () {
  const fileHash = ethers.keccak256(ethers.toUtf8Bytes('test'))
  const encryptedKey = ethers.toUtf8Bytes('key-data')

  await expect(fileRegistry.uploadFile(fileHash, encryptedKey))
    .to.emit(fileRegistry, 'FileUploaded')
})
```

### Example: Crypto Test

```javascript
it('Should encrypt and decrypt correctly', function () {
  const data = Buffer.from('test data')
  const key = generateSymmetricKey()
  
  const { ciphertext, iv, authTag } = encryptFile(data, key)
  const decrypted = decryptFile(ciphertext, key, iv, authTag)
  
  expect(decrypted).to.deep.equal(data)
})
```

## Troubleshooting

### Tests Failing

1. **Check Hardhat node**: Ensure local node is running if needed
2. **Check dependencies**: Run `npm install`
3. **Check environment**: Verify `.env` configuration
4. **Check logs**: Review test output for specific errors

### IPFS Connection Issues

If using real IPFS:
1. Verify IPFS daemon is running: `ipfs id`
2. Check IPFS_URL environment variable
3. Try using mock IPFS instead (default)

### Contract Deployment Issues

1. Ensure Hardhat network is running
2. Check contract compilation: `npm run compile`
3. Verify network configuration in `hardhat.config.js`

## Test Coverage Goals

- **Unit Tests**: >90% coverage
- **Integration Tests**: Cover all major flows
- **Fuzz Tests**: Find edge cases and bugs
- **E2E Tests**: Verify complete workflows

## Continuous Improvement

- Add tests for new features
- Update tests when behavior changes
- Run fuzz tests regularly to find bugs
- Review and improve test coverage

## Security Testing

Security-focused tests verify:
- Input validation
- Access control
- Error handling
- Key management
- Data privacy

Run security audit:
```bash
npm run security:audit
```

## Performance Testing

For performance testing:
- Use fuzz tests with larger data sizes
- Measure gas costs in contract tests
- Profile crypto operations

## Additional Resources

- [Hardhat Testing Guide](https://hardhat.org/docs/testing)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Mocha Test Framework](https://mochajs.org/)

---

Maintainer: Thor Thor  
Email: codethor@gmail.com  
LinkedIn: https://www.linkedin.com/in/thor-thor0

