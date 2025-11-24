// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * @title FileRegistry
 * @dev A secure registry for decentralized file storage using IPFS and blockchain
 * @notice This contract stores file metadata and encrypted keys on-chain
 */
contract FileRegistry {
    struct FileMetadata {
        bytes32 fileHash; // IPFS hash (keccak256)
        bytes encryptedKey; // Encrypted AES key
        address owner;
        uint256 timestamp;
    }

    mapping(bytes32 => FileMetadata) public files;
    mapping(address => bytes32[]) public userFiles;

    // Custom errors for gas efficiency
    error FileAlreadyExists(bytes32 fileHash);
    error FileNotFound(bytes32 fileHash);
    error InvalidFileHash();
    error InvalidEncryptedKey();
    error EncryptedKeyTooLarge(uint256 size, uint256 maxSize);
    error UnauthorizedAccess();
    error MaxFilesPerUserExceeded(uint256 currentCount, uint256 maxCount);

    event FileUploaded(bytes32 indexed fileHash, address indexed owner, uint256 timestamp);
    event FileDownloaded(bytes32 indexed fileHash, address indexed recipient);
    event FileAccessDenied(bytes32 indexed fileHash, address indexed requester);

    // Maximum size for encrypted key blob (1024 bytes)
    uint256 public constant MAX_ENCRYPTED_KEY_SIZE = 1024;
    
    // Maximum number of files per user to prevent unbounded array growth and gas exhaustion
    uint256 public constant MAX_FILES_PER_USER = 1000;

    /**
     * @dev Upload file metadata to the registry
     * @param fileHash The keccak256 hash of the IPFS CID
     * @param encryptedKey The encrypted AES key for file decryption
     * @notice Reverts if file already exists or inputs are invalid
     */
    function uploadFile(bytes32 fileHash, bytes memory encryptedKey) external {
        // Input validation
        if (fileHash == bytes32(0)) {
            revert InvalidFileHash();
        }
        if (encryptedKey.length == 0) {
            revert InvalidEncryptedKey();
        }
        if (encryptedKey.length > MAX_ENCRYPTED_KEY_SIZE) {
            revert EncryptedKeyTooLarge(encryptedKey.length, MAX_ENCRYPTED_KEY_SIZE);
        }
        
        // Check if file already exists
        if (files[fileHash].owner != address(0)) {
            revert FileAlreadyExists(fileHash);
        }
        
        // Store file metadata
        files[fileHash] = FileMetadata({
            fileHash: fileHash,
            encryptedKey: encryptedKey,
            owner: msg.sender,
            timestamp: block.timestamp
        });
        
        // Track user's files (prevent unbounded growth)
        uint256 currentFileCount = userFiles[msg.sender].length;
        if (currentFileCount >= MAX_FILES_PER_USER) {
            revert MaxFilesPerUserExceeded(currentFileCount, MAX_FILES_PER_USER);
        }
        userFiles[msg.sender].push(fileHash);
        
        emit FileUploaded(fileHash, msg.sender, block.timestamp);
    }

    /**
     * @dev Download file encrypted key from the registry
     * @param fileHash The keccak256 hash of the IPFS CID
     * @return encryptedKey The encrypted AES key
     * @notice This is a view function and does not emit events
     */
    function downloadFile(bytes32 fileHash) external view returns (bytes memory) {
        if (files[fileHash].owner == address(0)) {
            revert FileNotFound(fileHash);
        }
        
        return files[fileHash].encryptedKey;
    }

    /**
     * @dev Retrieve file encrypted key and emit download event
     * @param fileHash The keccak256 hash of the IPFS CID
     * @return encryptedKey The encrypted AES key
     * @notice This function emits FileDownloaded event for access tracking
     * @notice Only the file owner can retrieve the file (access control)
     */
    function retrieveFile(bytes32 fileHash) external returns (bytes memory) {
        if (files[fileHash].owner == address(0)) {
            revert FileNotFound(fileHash);
        }
        
        // Access control: only owner can retrieve and emit download event
        if (files[fileHash].owner != msg.sender) {
            emit FileAccessDenied(fileHash, msg.sender);
            revert UnauthorizedAccess();
        }
        
        emit FileDownloaded(fileHash, msg.sender);
        return files[fileHash].encryptedKey;
    }

    /**
     * @dev Get file metadata
     * @param fileHash The keccak256 hash of the IPFS CID
     * @return hash The file hash
     * @return owner The owner address
     * @return timestamp The upload timestamp
     */
    function getFileMetadata(bytes32 fileHash) external view returns (
        bytes32 hash,
        address owner,
        uint256 timestamp
    ) {
        if (files[fileHash].owner == address(0)) {
            revert FileNotFound(fileHash);
        }
        FileMetadata memory file = files[fileHash];
        return (file.fileHash, file.owner, file.timestamp);
    }

    /**
     * @dev Get all file hashes uploaded by a user
     * @param user The user address
     * @return Array of file hashes
     * @notice Returns empty array if user is zero address or has no files
     */
    function getUserFiles(address user) external view returns (bytes32[] memory) {
        if (user == address(0)) {
            return new bytes32[](0);
        }
        return userFiles[user];
    }

    /**
     * @dev Check if a file exists
     * @param fileHash The keccak256 hash of the IPFS CID
     * @return exists True if file exists
     */
    function fileExists(bytes32 fileHash) external view returns (bool exists) {
        return files[fileHash].owner != address(0);
    }

    /**
     * @dev Get file count for a user
     * @param user The user address
     * @return count Number of files uploaded by user
     */
    function getUserFileCount(address user) external view returns (uint256 count) {
        return userFiles[user].length;
    }
}

