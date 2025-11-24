# Red-Team Security Audit Findings

## Critical Issues Found

### 1. Unbounded Array Growth (HIGH SEVERITY)

**Location**: `contracts/FileRegistry.sol:67`

**Issue**: `userFiles[msg.sender].push(fileHash)` can grow unbounded, leading to:
- Gas exhaustion when calling `getUserFiles()` for users with many files
- DoS attacks by uploading thousands of files
- High gas costs for legitimate operations

**Impact**: 
- An attacker could upload many files to make `getUserFiles()` fail due to gas limits
- Legitimate users with many files could face high gas costs

**Recommendation**: 
- Add a maximum limit per user (e.g., 1000 files)
- Or implement pagination for `getUserFiles()`
- Or remove the array tracking if not essential

### 2. Missing Access Control on retrieveFile (MEDIUM SEVERITY)

**Location**: `contracts/FileRegistry.sol:92`

**Issue**: `retrieveFile()` can be called by anyone, allowing:
- Spam events (`FileDownloaded`) even for files not owned by caller
- Potential DoS through event spam
- Misleading access tracking

**Impact**: 
- Event logs could be polluted with false download events
- No way to distinguish legitimate downloads from spam

**Recommendation**: 
- Add access control (only owner or authorized recipients)
- Or emit `FileAccessDenied` event when unauthorized access is attempted
- Or make this function view-only if events aren't needed

### 3. Unused Error and Event (LOW SEVERITY)

**Location**: `contracts/FileRegistry.sol:26, 30`

**Issue**: 
- `UnauthorizedAccess` error is defined but never used
- `FileAccessDenied` event is defined but never emitted

**Impact**: 
- Confusing for developers
- Missing functionality that was apparently intended

**Recommendation**: 
- Either implement access control and use these, or remove them

### 4. No Protection Against Array Length Overflow (LOW SEVERITY)

**Location**: `contracts/FileRegistry.sol:67, 144`

**Issue**: While Solidity 0.8+ has built-in overflow protection, there's no explicit limit on array length, which could theoretically cause issues in extreme cases.

**Impact**: 
- Very low risk due to Solidity 0.8+ protections
- But unbounded growth is still a concern

**Recommendation**: 
- Add explicit maximum file count per user

## Medium Issues

### 5. Missing Input Validation for getUserFiles

**Location**: `contracts/FileRegistry.sol:125`

**Issue**: No validation that `user` address is not zero address.

**Impact**: 
- Could return empty array for zero address, which might be confusing

**Recommendation**: 
- Add zero address check (though low priority)

## Positive Security Features

- PASS Input validation for fileHash (zero check)
- PASS Input validation for encryptedKey (empty and size checks)
- PASS Prevents duplicate file uploads
- PASS Custom errors for gas efficiency
- PASS No reentrancy vulnerabilities (no external calls)
- PASS View functions properly marked
- PASS Events don't expose sensitive data

## Recommendations Summary

1. **CRITICAL**: Add maximum file limit per user to prevent unbounded array growth
2. **HIGH**: Add access control to `retrieveFile()` or remove event emission
3. **MEDIUM**: Implement `FileAccessDenied` event or remove unused code
4. **LOW**: Add zero address validation for `getUserFiles()`

