# Changelog

All notable changes to the Cyberia (CAP) Token project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2025-10-21

### Added

- LayerZero V2 OFT integration deployed to testnets
  - Sepolia OFTAdapter: `0xf3d4e50Cb073d707d54Af96d157183e561212F4F`
  - Arbitrum Sepolia OFT: `0x073a66b4136A6b62AbAb0914D9540b1808D01526`
- Pre-deployment balance checks and gas estimation in deployment scripts
- New utility scripts for LayerZero:
  - `scripts/check-peers.ts` - Verify peer configurations and detect stale settings
  - `scripts/check-oft-balance.ts` - Check CAP token balance on destination chains
  - `scripts/layerzero/remove-stale-peer.ts` - Clean up incorrect peer configurations
- New npm scripts for better workflow:
  - `npm run test:all` - Run all tests (297 passing: 191 Hardhat + 106 Foundry)
  - `npm run test:ci` - Full CI validation (linters + all tests)
  - `npm run oft:check-balance` - Check OFT balance on destination chains
  - `npm run oft:check-peers` - Verify peer configurations
  - `npm run oft:test-bridge` - Test cross-chain bridging
- TESTNET_OWNER_ADDRESS environment variable pattern to simplify testnet configuration
- Network-specific faucet links in deployment error messages
- Comprehensive deployment documentation:
  - `DEPLOYMENT_ISSUES.md` - Detailed tracking of all deployment issues and fixes
  - `DEPLOYMENT_FIXES_SUMMARY.md` - Summary of all fixes applied

### Changed

- Updated test count from 250 to 297 tests (added LayerZero integration tests)
- Improved deployment scripts with balance validation and cost estimation
- Enhanced error messages in deployment scripts with actionable guidance
- Updated README.md to reflect testnet deployments and new scripts
- Simplified testnet environment configuration with fallback pattern

### Fixed

- BigInt JSON serialization error in deploy-oft.ts (line 194)
- Wrong Ethereum EID configuration (30101 mainnet vs 40161 Sepolia) in configure-oft-peers.ts
- Missing balance checks before deployment attempts
- All TypeScript linter errors (1,234 → 0 errors)
- Unused variable warnings in test files
- Stale peer configuration on Arbitrum Sepolia OFT

### Deployed

- **Sepolia OFTAdapter**: `0xf3d4e50Cb073d707d54Af96d157183e561212F4F` ✅ Verified
- **Arbitrum Sepolia OFT**: `0x073a66b4136A6b62AbAb0914D9540b1808D01526` ✅ Verified

## [1.2.0] - 2025-10-17

### Added

- Uniswap V4 pool integration and documentation
- Aragon DAO integration with comprehensive testing
- Zodiac Safe testing and configuration
- Automated deployment system for Sepolia network
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

- Restructured documentation for better organization
- Updated QUICK_START guide with localhost configuration
- Updated OpenZeppelin deployment information
- Updated README.md with linting commands and new documentation links
- Improved project organization and tooling

### Fixed

- Prevented prettier from formatting submodule files

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

[Unreleased]: https://github.com/cyberia-to/cyberia-token/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/cyberia-to/cyberia-token/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/cyberia-to/cyberia-token/compare/v1.1.0...v1.2.0
[1.0.0]: https://github.com/cyberia-to/cyberia-token/releases/tag/v1.0.0
