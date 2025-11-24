# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. **DO NOT** open a public issue

Please do not report security vulnerabilities through public GitHub issues.

### 2. Email Security Team

Send an email to: [security@decentrafile.io] (or create a private security advisory on GitHub)

Include the following information:
- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- The location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity and complexity

### 4. Disclosure Policy

- We will acknowledge receipt of your vulnerability report
- We will provide an estimated timeline for a fix
- We will notify you when the vulnerability has been fixed
- We will credit you in our security advisories (if desired)

## Security Best Practices

### For Users

1. **Private Keys**: Never share your private keys or commit them to version control
2. **Environment Variables**: Use `.env` files for sensitive configuration (already in `.gitignore`)
3. **Network Security**: Only connect to trusted RPC endpoints
4. **File Size Limits**: Be aware of file size limits to prevent DoS attacks
5. **IPFS Pinning**: Ensure important files are pinned to prevent garbage collection

### For Developers

1. **Code Reviews**: All code changes must be reviewed by at least one other developer
2. **Testing**: Write comprehensive tests, especially for security-critical functions
3. **Static Analysis**: Run linting and security analysis tools before committing
4. **Dependency Updates**: Regularly update dependencies to patch vulnerabilities
5. **Input Validation**: Always validate and sanitize user inputs

## Security Measures Implemented

### Smart Contract Security

- Input validation for all function parameters
- Custom errors for gas efficiency
- Reentrancy protection (using Solidity 0.8.20 built-in protections)
- Access control checks
- Overflow/underflow protection (Solidity 0.8.20)

### Client-Side Security

- Input validation using Joi
- File size limits
- AES-256-GCM encryption for files
- Secure key generation using crypto.randomBytes
- Error handling and logging
- Environment variable management

### Infrastructure Security

- CI/CD pipeline with automated testing
- Automated dependency scanning (Dependabot)
- Code linting (ESLint, Solhint)
- Security audit scripts
- Comprehensive logging

## Known Limitations

1. **IPFS Hash Mapping**: Currently, IPFS hash to fileHash mapping needs to be stored separately or retrieved from events
2. **Key Encryption**: Current implementation stores encrypted keys in a simplified format - production should use recipient public keys
3. **Access Control**: File access is currently open - consider implementing permission-based access
4. **Rate Limiting**: No rate limiting implemented - consider adding for production use

## Security Audit Recommendations

Before deploying to mainnet:

1. **Automated Tools**: Run Slither, MythX, or CertiK automated analysis
2. **Manual Review**: Have smart contracts reviewed by experienced auditors
3. **Formal Verification**: Consider formal verification for critical functions
4. **Penetration Testing**: Conduct penetration testing on the full system
5. **Bug Bounty**: Consider launching a bug bounty program

## Security Checklist

Before each release:

- [ ] All tests passing
- [ ] Code reviewed by at least one other developer
- [ ] Linting passed (ESLint, Solhint)
- [ ] Security audit completed
- [ ] Dependencies updated and audited
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Security considerations documented

## Contact

For security-related questions or concerns, please contact the security team.

---

**Last Updated**: 2025-01-27

---

Maintainer: Thor Thor  
Email: codethor@gmail.com  
LinkedIn: https://www.linkedin.com/in/thor-thor0

