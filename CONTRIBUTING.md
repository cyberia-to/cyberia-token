# Contributing to Cyberia (CAP) Token

Thank you for your interest in contributing to the Cyberia (CAP) Token project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Security](#security)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Prioritize security and code quality
- Document your changes clearly

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/cyberia-token.git
cd cyberia-token
git remote add upstream https://github.com/cyberia-to/cyberia-token.git
```

### 2. Install Dependencies

```bash
npm install
```

This will also set up **Husky pre-commit hooks** automatically via the `prepare` script.

### 3. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/issue-description
```

## Development Process

### 1. Make Your Changes

- Write clean, readable code
- Follow existing code patterns
- Add tests for new functionality
- Update documentation as needed

### 2. Code Quality Checks (Automated)

**Pre-commit hooks run automatically** when you commit, but you can also run them manually:

```bash
# Format code
npm run format

# Lint TypeScript
npm run lint

# Lint Solidity
npm run lint:sol

# Run tests
npm test

# Check coverage
npm run test:coverage
```

**What happens on commit:**

- ✅ Staged files are automatically linted and formatted
- ✅ TypeScript: ESLint + Prettier
- ✅ Solidity: Solhint + Prettier
- ✅ JSON/Markdown: Prettier

**Skip hooks (emergency only):**

```bash
git commit --no-verify -m "message"
```

### 3. Commit Your Changes

Use conventional commit messages:

```bash
# Feature
git commit -m "feat: add tax exemption for specific addresses"

# Bug fix
git commit -m "fix: resolve reentrancy vulnerability in transfer"

# Documentation
git commit -m "docs: update deployment guide"

# Tests
git commit -m "test: add edge case tests for timelock"

# Chore
git commit -m "chore: upgrade dependencies"
```

### 4. Keep Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch
git rebase upstream/main
```

### 5. Push Changes

```bash
git push origin feature/your-feature-name
```

## Pull Request Process

### 1. Create Pull Request

- Go to GitHub and create a PR from your fork
- Use a clear, descriptive title
- Fill out the PR template completely
- Reference any related issues

### 2. PR Title Format

```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add new tests
refactor: improve code structure
chore: maintenance tasks
```

### 3. PR Description Should Include

- **What**: What changes were made
- **Why**: Why these changes are needed
- **How**: How the changes work
- **Testing**: How you tested the changes
- **Screenshots**: If applicable (UI changes)

### 4. Review Process

- Wait for CI checks to pass
- Address reviewer feedback
- Update PR as needed
- Once approved, maintainers will merge

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for public functions
- Maximum line length: 120 characters

Example:

```typescript
/**
 * Deploys a new token contract
 * @param owner - Address of the contract owner
 * @param feeRecipient - Address to receive fees
 * @returns Deployed contract instance
 */
async function deployToken(owner: string, feeRecipient: string): Promise<CAPToken> {
  const factory = await ethers.getContractFactory("CAPToken");
  return await factory.deploy(owner, feeRecipient);
}
```

### Solidity

- Solidity version: `^0.8.24`
- Follow OpenZeppelin patterns
- Use NatSpec comments
- Maximum line length: 140 characters
- Maximum function complexity: 8
- Maximum function lines: 100

Example:

```solidity
/// @notice Sets the fee recipient address
/// @dev Only callable by contract owner
/// @param _feeRecipient New fee recipient address (zero address enables burn mode)
function setFeeRecipient(address _feeRecipient) external onlyOwner {
  address oldRecipient = feeRecipient;
  feeRecipient = _feeRecipient;
  emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
}
```

### Formatting

- Run `npm run format` before committing
- Prettier handles formatting automatically
- Configuration in `.prettierrc.json`

## Testing Requirements

### Test Coverage

- All new features must have tests
- Maintain > 95% line coverage
- Maintain > 90% branch coverage
- 100% function coverage

### Test Types

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test component interactions
3. **Security Tests**: Test access control and edge cases
4. **Gas Tests**: Monitor gas usage

### Writing Tests

```typescript
describe("New Feature", function () {
  async function deployFixture() {
    // Setup code
    const [owner, user] = await ethers.getSigners();
    const contract = await deployContract();
    return { contract, owner, user };
  }

  it("should handle the happy path", async function () {
    const { contract, user } = await loadFixture(deployFixture);
    await expect(contract.connect(user).newFeature()).to.emit(contract, "EventName").withArgs(expectedValue);
  });

  it("should revert on invalid input", async function () {
    const { contract, user } = await loadFixture(deployFixture);
    await expect(contract.connect(user).newFeature(invalidInput)).to.be.revertedWith("ERROR_MESSAGE");
  });
});
```

### Running Tests

```bash
# Run all tests (200 Hardhat tests + 106 Foundry = 306 total)
npm test

# Run specific test file
npm run test:unit

# Run all tests including Foundry
npm run test:all

# Generate coverage
npm run test:coverage

# Gas report
npm run test:gas
```

**Expected Results**: All 200 Hardhat tests must pass before submitting a PR. CI will also run Foundry tests (106 additional tests).

## Security

### Security First

- Security is the top priority
- All changes are security-reviewed
- Report vulnerabilities privately

### Security Checklist

Before submitting PR:

- [ ] No new reentrancy vulnerabilities
- [ ] Access control properly implemented
- [ ] Integer overflow/underflow prevented
- [ ] Gas optimization considered
- [ ] Edge cases handled
- [ ] Security tests added

### Reporting Vulnerabilities

**Do NOT open public issues for security vulnerabilities.**

Instead:

1. Email: security@cyberia.to (if available)
2. Or create a private security advisory on GitHub

Include:

- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Documentation

### Required Documentation Updates

- Update README.md if user-facing changes
- Update relevant docs in `docs/` folder
- Add JSDoc/NatSpec comments to code
- Update CHANGELOG.md (if exists)

### Documentation Style

- Use clear, concise language
- Include code examples
- Add links to related docs
- Keep formatting consistent

## Questions?

- Check [Development Guide](docs/DEVELOPMENT.md)
- Open a [Discussion](https://github.com/cyberia-to/cyberia-token/discussions)
- Ask in PR comments

## Recognition

Contributors will be recognized in:

- GitHub contributors list
- Project documentation (for significant contributions)
- Release notes (for major features)

Thank you for contributing to Cyberia (CAP) Token! 🚀
