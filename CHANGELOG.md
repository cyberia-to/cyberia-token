# Changelog

All notable changes to the Cyberia (CAP) Token project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions CI/CD pipeline with automated testing, linting, and coverage
- ESLint configuration for TypeScript code quality
- Prettier for consistent code formatting (TypeScript, Solidity, JSON, Markdown)
- Solhint for Solidity linting and security checks
- Pre-commit hooks with Husky and lint-staged
- Comprehensive development guide (`docs/DEVELOPMENT.md`)
- Contributing guidelines (`CONTRIBUTING.md`)
- CHANGELOG.md for version tracking
- NPM scripts for linting and formatting:
  - `npm run lint` - Lint TypeScript
  - `npm run lint:fix` - Auto-fix TypeScript issues
  - `npm run lint:sol` - Lint Solidity
  - `npm run lint:sol:fix` - Auto-fix Solidity issues
  - `npm run format` - Format all code
  - `npm run format:check` - Check code formatting

### Changed

- Updated README.md with linting commands and new documentation links
- Improved project organization and tooling

### Removed

- Removed unused `@nomicfoundation/hardhat-ignition-ethers` dependency

## [1.0.0] - 2024-10-14

### Added

- Initial release of Cyberia (CAP) Token
- ERC-20 token with EIP-2612 Permit support
- ERC-20 Votes for governance compatibility
- UUPS upgradeable pattern using OpenZeppelin
- Configurable tax system:
  - Transfer tax (default: 1%)
  - Sell tax (default: 1%)
  - Buy tax (default: 0%)
  - Combined tax cap: 8%
- 24-hour timelock for tax changes
- AMM pool detection for buy/sell tax logic
- Pool-to-pool transfer tax exemption
- Burn mechanism (fee recipient = zero address)
- Owner-gated minting with max supply cap (10B tokens)
- ReentrancyGuard protection on all transfers
- Comprehensive test suite:
  - 99 tests covering core functionality
  - Security tests (reentrancy, access control, timelock)
  - Edge case tests
  - Integration tests (Aragon DAO, mainnet fork)
  - Advanced security tests (EIP-2612, storage collisions)
  - Checkpoint tests
  - Invariant tests
  - Timelock boundary tests
- Deployment scripts for localhost, Sepolia, and mainnet
- Contract upgrade scripts
- Configuration scripts for post-deployment setup
- Etherscan verification scripts
- Zodiac roles validation script
- TypeChain type generation for TypeScript
- Gas reporting functionality
- Coverage reporting with Solidity coverage
- Comprehensive documentation:
  - Governance guide
  - Deployment guide
  - Quick start guide
  - Aragon integration guide
  - Gnosis Safe setup guide

### Security

- OpenZeppelin Contracts v5.4.0 (audited libraries)
- ReentrancyGuard on transfer logic
- Access control with Ownable pattern
- Timelock mechanism for critical parameter changes
- Max supply cap enforcement
- Tax validation and boundary checks

### Deployed

- **Sepolia Testnet**: `0xA419fD4e3BA375250d5D946D91262769F905aEED` ✅ Verified

---

## Release Types

### Major (X.0.0)

- Breaking changes to contract interface
- Major feature additions requiring upgrade
- Security-critical changes

### Minor (0.X.0)

- New features (backward compatible)
- New administrative functions
- Documentation improvements

### Patch (0.0.X)

- Bug fixes
- Security patches
- Configuration updates
- Documentation fixes

---

## Upgradeability

This contract uses the UUPS (Universal Upgradeable Proxy Standard) pattern. Upgrades are:

- Owner-only (DAO governance)
- Require proposal and execution through governance
- Should include comprehensive testing before deployment
- Should maintain storage layout compatibility

---

## Security Notices

### Current Status

⚠️ **Not audited**: This contract has not undergone a professional security audit. A third-party security audit is required before mainnet deployment.

### Reporting Vulnerabilities

Please report security vulnerabilities privately via:

- GitHub Security Advisories
- Email: security@cyberia.to (if available)

Do NOT open public issues for security vulnerabilities.

---

## Links

- **Repository**: https://github.com/cyberia-to/cyberia-token
- **Documentation**: [docs/](docs/)
- **Sepolia Deployment**: https://sepolia.etherscan.io/address/0xA419fD4e3BA375250d5D946D91262769F905aEED

---

[Unreleased]: https://github.com/cyberia-to/cyberia-token/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/cyberia-to/cyberia-token/releases/tag/v1.0.0
