# Security Audit Findings

## Issues Fixed

### 1. Privacy Leaks in Logging (CRITICAL - FIXED)

**Issue**: Unmasked fileHash values logged in multiple places
- Line 246: `logger.info('Starting file download', { fileHash, contractAddress })`
- Line 254: `logSecurityEvent('FILE_NOT_FOUND', { fileHash })`
- Line 278: `logSecurityEvent('INVALID_ENCRYPTED_KEY', { fileHash })`
- Line 309: `logSecurityEvent('DECRYPTION_FAILED', { fileHash })`

**Fix**: All fileHash values are now masked before logging. Added masking to `logSecurityEvent` function.

### 2. Incorrect FileHash Generation (FIXED)

**Issue**: `web3.utils.keccak256(web3.utils.toHex(ipfsHash))` was redundant and potentially incorrect.
- `web3.utils.toHex()` on a string converts it to hex representation, not the actual bytes
- `keccak256()` can hash strings directly

**Fix**: Changed to `web3.utils.keccak256(ipfsHash)` for direct hashing.

### 3. Unused Imports (CLEANUP - FIXED)

**Issue**: Unused imports cluttering code
- `pinFile` imported but never used
- `validateFilePath`, `validatePrivateKey`, `validateAddress`, `validateFileHash` imported but not used directly (used via validateUploadParams/validateDownloadParams)

**Fix**: Removed unused imports.

## Verified Correct Implementations

### Smart Contract (FileRegistry.sol)
- Custom errors properly used
- View functions do not emit events
- Bounds checking on encrypted key size (1024 bytes max)
- Input validation for zero hashes and empty keys
- No reentrancy issues (no external calls after state changes)
- Events do not expose sensitive data (only fileHash, owner, timestamp)

### Crypto Module (src/crypto/crypto.js)
- AES-256-GCM correctly implemented
- IV size is 16 bytes (128 bits) - correct for GCM
- Key size is 32 bytes (256 bits) - correct for AES-256
- Authentication tag properly handled
- RSA-OAEP key wrapping correctly implemented
- Secure key zeroing implemented
- Input validation comprehensive

### Application Logic (src/index.js)
- Proper error handling with try/catch
- Keys zeroed after use
- Input validation before operations
- IPFS hash mapping implemented (in-memory, documented limitation)
- Plaintext key storage clearly marked with security warnings

### Logging (src/utils/logger.js)
- Privacy-aware logging functions
- Sensitive data scrubbing in error messages
- Hash and address masking
- Stack traces only in development

### IPFS Module (src/ipfs.js)
- Structured logging instead of console.error
- Input validation
- Privacy-aware error messages

## Known Limitations (Documented)

1. **Plaintext Key Storage**: Temporary mode exists with security warnings. Should be replaced with mandatory recipient public key wrapping.

2. **IPFS Hash Mapping**: Uses in-memory Map. Production should use contract events or off-chain storage.

3. **IV/AuthTag Storage**: Full recipient-based unwrapping requires IV/authTag storage mechanism (not yet implemented).

4. **Unused Event**: `FileAccessDenied` event is defined but never emitted. May be intended for future access control.

## Test Coverage

Tests cover:
- Valid upload/download flows
- Invalid inputs (zero hashes, empty keys)
- Size limit enforcement
- Custom error assertions
- View function behavior
- Event emission verification

## Recommendations

1. Remove plaintext key storage mode before production
2. Implement IV/authTag storage for recipient-based unwrapping
3. Use contract events for IPFS hash mapping in production
4. Consider emitting FileAccessDenied event if access control is added
5. Add integration tests for full upload/download flows with mocked IPFS/blockchain

## Security Posture

**Overall**: Good. Critical privacy leaks fixed. Core cryptographic operations are sound. Known limitations are clearly documented. Code follows security best practices.

**Status**: Ready for testing and review. Production deployment should address documented limitations.

