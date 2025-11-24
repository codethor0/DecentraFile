# Contributing to DecentraFile

Thank you for your interest in contributing to DecentraFile! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in the Issues section
2. If not, create a new issue using the bug report template with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check if the feature has already been suggested
2. Create a new issue using the feature request template with:
   - Clear description of the feature
   - Use case and motivation
   - Proposed implementation (if you have ideas)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Write or update tests if applicable
5. Ensure all tests pass (`npm test`)
6. Run linting (`npm run lint`)
7. Run security audit (`npm run security:audit`)
8. Commit your changes (`git commit -m 'Add some feature'`)
9. Push to the branch (`git push origin feature/your-feature-name`)
10. Open a Pull Request

## Code Style

- Follow the ESLint and Solhint configurations provided in the repository
- Use meaningful variable and function names
- Write clear and concise comments
- Follow the existing code style and formatting

## Development Workflow

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make changes**: Implement your feature or fix
3. **Run tests**: `npm test`
4. **Run linting**: `npm run lint`
5. **Run security audit**: `npm run security:audit`
6. **Commit changes**: Use clear, descriptive commit messages
7. **Push and create PR**: Push your branch and create a pull request

## Testing Requirements

- Write tests for new features
- Ensure all existing tests pass
- Aim for good test coverage
- Test edge cases and error scenarios

## Security Checklist

Before submitting a PR, ensure:

- [ ] Static code analysis completed (`npm run lint`)
- [ ] Input validation implemented (if handling user input)
- [ ] Error handling enhanced (if applicable)
- [ ] Logging and monitoring in place (if applicable)
- [ ] Automated tests passing (`npm test`)
- [ ] CI/CD pipeline running successfully
- [ ] Dependencies up-to-date and scanned for vulnerabilities (`npm audit`)
- [ ] No sensitive data exposed
- [ ] Security considerations documented

## Commit Messages

- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Keep the first line under 72 characters
- Add more details in the body if needed

Examples:
```
Add file encryption with AES-256-GCM

- Implement encryption before IPFS upload
- Add key generation and management
- Update upload function to handle encryption
```

```
Fix file download error handling

- Add proper error messages
- Handle IPFS connection failures gracefully
- Update logging for better debugging
```

## Development Setup

1. Clone your fork: `git clone https://github.com/your-username/DecentraFile.git`
2. Install dependencies: `npm install`
3. Set up environment: `cp .env.example .env`
4. Compile contracts: `npm run compile`
5. Run tests: `npm test`

## Testing

- Write tests for new features
- Ensure all existing tests pass
- Aim for good test coverage
- Test edge cases and error handling

## Questions?

If you have questions about contributing, please:
- Open an issue with the `question` label
- Check existing issues and discussions
- Review the documentation in README.md and SECURITY.md

Thank you for contributing to DecentraFile!

---

Maintainer: Thor Thor  
Email: codethor@gmail.com  
LinkedIn: https://www.linkedin.com/in/thor-thor0
