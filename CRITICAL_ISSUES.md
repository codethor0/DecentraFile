# Critical Security and Design Issues Found

## CRITICAL: IPFS Hash Mapping Loss (HIGH SEVERITY)

**Location**: `src/index.js:84, 330`

**Issue**: 
- IPFS hash to fileHash mapping is stored only in memory (`ipfsHashMapping` Map)
- If the application restarts, all mappings are lost
- The comment says "Try to reconstruct from fileHash" but this is **IMPOSSIBLE** - keccak256 is a one-way hash function
- Files uploaded before a restart become permanently inaccessible

**Impact**:
- **Data Loss**: Users cannot download files after server restart
- **Permanent Lockout**: Files become permanently inaccessible
- **No Recovery**: Cannot reconstruct IPFS hash from fileHash

**Current Code**:
```javascript
// In-memory mapping - LOST ON RESTART
const ipfsHashMapping = new Map()

// Later...
const ipfsHash = ipfsHashMapping.get(fileHash)
if (!ipfsHash) {
  // Comment says "Try to reconstruct" - BUT THIS IS IMPOSSIBLE!
  throw new Error('IPFS hash not found in mapping...')
}
```

**Root Cause**:
- `fileHash = keccak256(ipFSHash)` is a one-way hash
- Cannot reverse keccak256 to get original IPFS hash
- Mapping must be stored persistently

**Solutions**:

1. **Emit IPFS hash in contract event** (RECOMMENDED):
   - Add IPFS hash to `FileUploaded` event
   - Parse events when downloading to get IPFS hash
   - Requires contract change

2. **Store mapping in database/file**:
   - Use persistent storage (SQLite, JSON file, etc.)
   - Survives restarts
   - Requires infrastructure

3. **Include IPFS hash in encrypted key metadata**:
   - Store IPFS hash alongside key data
   - Can retrieve from contract
   - Increases on-chain storage

**Recommendation**: Implement solution #1 (event-based) as it's most robust and doesn't require external storage.

## MEDIUM: Missing Validation in downloadFileFromBlockchain

**Location**: `src/index.js:247`

**Issue**: 
- Line 247 shows incomplete code: `const validation = validateDownloadParams`
- Missing function call parentheses

**Impact**: 
- Code will throw runtime error
- Download function will fail immediately

**Fix**: Should be `validateDownloadParams({ fileHash, contractAddress, outputPath })`

## MEDIUM: No Timeout on IPFS Operations

**Location**: `src/ipfs.js`

**Issue**:
- IPFS operations (`uploadFile`, `downloadFile`) have no timeout
- Can hang indefinitely if IPFS node is unresponsive
- No retry logic

**Impact**:
- Application can hang waiting for IPFS
- Poor user experience
- Resource exhaustion

**Recommendation**: Add timeouts and retry logic to IPFS operations.

## LOW: Missing Error Handling for File Write

**Location**: `src/index.js:372`

**Issue**:
- `fs.writeFileSync(outputPath, decryptedFile)` can fail (permissions, disk full, etc.)
- No try/catch around file write
- Symmetric key already zeroed, so no security issue, but user gets unclear error

**Impact**:
- Unclear error messages if file write fails
- No cleanup of partial files

**Recommendation**: Add explicit error handling and cleanup.

