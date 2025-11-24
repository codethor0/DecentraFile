# Formal Invariant and Spec-Driven Audit Findings

## Protocol Specification (Derived from Code)

### Core Protocol
- **File Portal**: Encrypted file transfer via IPFS + blockchain metadata
- **fileHash**: `keccak256(IPFS_CID_string)` - one-way hash, cannot be reversed
- **On-chain state**: FileMetadata (fileHash, encryptedKey, owner, timestamp), userFiles mapping
- **Off-chain state**: IPFS CID → fileHash mapping (in-memory, optionally persisted)

### Invariants (I1-I4)

**I1: MAX_FILES_PER_USER Enforcement**
- A user can never have more than MAX_FILES_PER_USER (1000) file entries
- Enforced before push operation in uploadFile

**I2: File Metadata Consistency**
- For any fileHash stored: encryptedKey.length > 0 && <= MAX_ENCRYPTED_KEY_SIZE
- owner != address(0)
- timestamp > 0

**I3: Access Control**
- retrieveFile(): Only owner can call, emits FileDownloaded event
- downloadFile(): Anyone can call (view function, no events)
- getUserFiles(): Anyone can call (view function, no access control)

**I4: getUserFiles Consistency**
- Returns empty array for zero address
- Returns deterministic data for same chain state
- No access control (public view function)

## Critical Bugs Found

### BUG-1: Documentation Inconsistency - getUserFiles Access Control (RESOLVED - FALSE POSITIVE)

**Location**: `FORMAL_AUDIT_FINDINGS.md` (this file)

**Issue**: 
- Previous version of this document incorrectly claimed documentation says "Added owner-only access control" for getUserFiles
- Actual documentation correctly states access control was added to `retrieveFile()`, not `getUserFiles()`
- `RED_TEAM_AUDIT_SUMMARY.md` line 47 explicitly notes: "getUserFiles() is intentionally a public view function with no access control"

**Status**: RESOLVED - Documentation is correct. This was a false positive in the audit findings. The contract behavior (public view function) matches the documented behavior.

### BUG-2: Non-Atomic IPFS Mapping File Write (RESOLVED)

**Location**: `src/index.js:112-142`

**Status**: RESOLVED - Atomic write pattern is implemented

**Implementation**: 
- `saveIPFSMapping()` uses temp file + rename pattern (lines 120-124)
- Writes to `IPFS_MAPPING_FILE + '.tmp'` first
- Then atomically renames temp file to target file
- Proper error handling and cleanup

**Verification**: Code correctly implements atomic writes. Documentation was outdated.

### BUG-3: Missing Error Handling in loadIPFSMapping (RESOLVED)

**Location**: `src/index.js:45-104`

**Status**: RESOLVED - Error handling and recovery implemented

**Implementation**:
- JSON.parse errors are caught (line 87)
- Corrupted file is backed up with timestamp (lines 92-96)
- Empty mapping returned on failure (line 89)
- Validation of parsed data structure (lines 59-62)
- Entry-by-entry validation (lines 67-76)

**Verification**: Code has proper error handling and backup mechanism. Documentation was outdated.

### BUG-4: Race Condition in Concurrent Mapping Updates (MITIGATED)

**Location**: `src/index.js:112-142`

**Status**: MITIGATED - Reload from disk before write reduces race condition impact

**Issue**:
- Multiple concurrent uploads could overwrite mapping file
- Last write wins, earlier writes lost
- No locking mechanism

**Mitigation Applied**:
- `saveIPFSMapping` now reloads from disk before writing (line 115-118)
- Merges disk state with in-memory state before write
- Reduces but does not eliminate race condition

**Impact**:
- Reduced risk of data loss in concurrent scenarios
- Still possible if two writes happen simultaneously
- Acceptable for single-process applications with sequential uploads

**Remaining Risk**: Low - JavaScript is single-threaded, so true concurrency is limited. For production multi-process deployments, consider file locking or database.

### BUG-5: Missing Validation for Empty fileHash in getUserFiles (RESOLVED - NOT A BUG)

**Location**: `contracts/FileRegistry.sol:141-146`

**Status**: RESOLVED - Not a bug, invariant enforced at upload time

**Analysis**:
- `uploadFile` explicitly rejects zero fileHash (line 47-49)
- Zero fileHash cannot be added to `userFiles` array
- `getUserFiles` correctly returns array as-is (no filtering needed)
- Invariant is enforced at the entry point, not at read time

**Impact**: None - zero fileHash is prevented at upload, so it cannot appear in userFiles

**Verification**: Contract prevents zero fileHash upload, making getUserFiles filtering unnecessary.

## Security Concerns

### SC-1: Plaintext Key Storage Mode Still Present

**Location**: `src/index.js:220-240`

**Issue**: 
- Temporary plaintext key storage mode exists
- Security warning logged but mode still functional
- Should be removed before production

**Impact**: Critical if used in production

**Status**: Documented limitation, needs removal

### SC-2: IPFS Mapping Persistence Not Guaranteed

**Location**: `src/index.js:132-140`

**Issue**:
- Mapping is in-memory by default
- Requires IPFS_MAPPING_FILE env var for persistence
- No validation that persistence is configured

**Impact**: Data loss on restart if not configured

**Status**: Documented limitation

## Code Quality Issues

### CQ-1: Magic Number in Gas Limit

**Location**: `src/index.js:258`

**Issue**: Hard-coded gas limit `500000` - should be configurable or calculated

**Impact**: Could fail on networks with different gas requirements

### CQ-2: Missing Input Validation for recipientPublicKey Format

**Location**: `src/index.js:217`

**Issue**: No validation that recipientPublicKey is valid PEM format before use

**Impact**: Could fail with unclear error if invalid format provided

## Test Coverage Gaps

### TC-1: Missing Test for getUserFiles Access Control (or lack thereof)

**Location**: `test/FileRegistry.test.js`

**Issue**: No test explicitly verifies that getUserFiles can be called by anyone

**Fix Required**: Add test documenting public access behavior

### TC-2: Missing Test for Concurrent Mapping Writes

**Location**: Test suite

**Issue**: No test simulates concurrent uploads and mapping file writes

**Fix Required**: Add integration test for concurrent operations

### TC-3: Missing Test for Corrupted Mapping File Recovery

**Location**: Test suite

**Issue**: No test for handling corrupted mapping file

**Fix Required**: Add test for corruption scenarios

## Next Steps

1. Fix documentation inconsistency (BUG-1)
2. Implement atomic file writes (BUG-2)
3. Add file locking for concurrent writes (BUG-4)
4. Add tests for identified gaps
5. Remove plaintext key storage mode (SC-1)
6. Add validation for recipientPublicKey format (CQ-2)

