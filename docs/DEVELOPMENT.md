# Development Guide

This guide covers the development workflow, tooling, and best practices for contributing to the Cyberia (CAP) Token project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Code Quality](#code-quality)
- [Testing](#testing)
- [Deployment](#deployment)
- [CI/CD](#cicd)

## Prerequisites

- **Node.js**: >= 20.0.0 (recommended: 20.19.5 via Volta)
- **npm**: >= 10.0.0
- **Git**: Latest version

## Setup

### Initial Setup

```bash
# Clone repository with submodules (recommended)
git clone --recurse-submodules https://github.com/cyberia-to/cyberia-token.git
cd cyberia-token

# OR if you already cloned without submodules
git clone https://github.com/cyberia-to/cyberia-token.git
cd cyberia-token
git submodule update --init --recursive

# Install dependencies
npm install

# (Optional) Install Foundry for advanced testing
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Copy environment file
cp .env.example .env

# Configure .env with your settings (see .env.example for details)
```

### Environment Configuration

For local development, default values work out of the box. For testnet/mainnet deployments, configure:

```bash
# Network RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Wallet
PRIVATE_KEY=0x...  # 66 characters (0x + 64 hex)

# Contract Verification
ETHERSCAN_API_KEY=...

# Deployment addresses
SEPOLIA_OWNER_ADDRESS=0x...      # DAO governance address
SEPOLIA_FEE_RECIPIENT=0x...      # Treasury/Safe address
```

## Development Workflow

### 1. Start Local Node

```bash
# Terminal 1: Start Hardhat local node
npm run node
```

### 2. Compile Contracts

```bash
# Compile Solidity contracts
npm run build

# Clean and rebuild
npm run clean && npm run build
```

### 3. Run Tests

```bash
# Run all Hardhat tests
npm test

# Run specific test suites
npm run test:unit           # Core functionality
npm run test:security       # Security tests
npm run test:integration    # DAO integration

# Run Foundry tests (requires Foundry installation and git submodules)
npm run test:foundry              # All Foundry tests
npm run test:foundry:fuzz         # Fuzz testing
npm run test:foundry:invariant    # Invariant testing
npm run test:foundry:stateful     # Stateful testing

# Generate coverage report
npm run test:coverage
npm run test:foundry:coverage     # Foundry coverage

# Gas usage analysis
npm run test:gas
npm run test:foundry:gas          # Foundry gas report
```

### 4. Code Quality Checks

```bash
# Format code (auto-fix)
npm run format

# Check formatting without changes
npm run format:check

# Lint TypeScript
npm run lint
npm run lint:fix

# Lint Solidity
npm run lint:sol
npm run lint:sol:fix
```

### 5. Deploy Locally

```bash
# Terminal 2 (with node running in Terminal 1)
npm run deploy:localhost

# Test deployment
npm run test:localhost
```

## Code Quality

### Linting & Formatting

This project uses:

- **ESLint** - TypeScript linting with TypeScript-ESLint parser
- **Prettier** - Code formatting for TypeScript, Solidity, JSON, Markdown
- **Solhint** - Solidity linting and security checks

#### Configuration Files

- `.eslintrc.json` - ESLint rules for TypeScript
- `.prettierrc.json` - Prettier formatting rules
- `.solhint.json` - Solhint rules for Solidity

#### Pre-commit Hooks (Automated)

This project uses **Husky** and **lint-staged** to automatically run quality checks before commits:

- ✅ Auto-formats staged TypeScript and Solidity files
- ✅ Auto-lints and fixes issues in staged files
- ✅ Runs on every `git commit` automatically

**What runs automatically:**

- TypeScript: ESLint (with auto-fix) + Prettier
- Solidity: Solhint (with auto-fix) + Prettier
- JSON/Markdown: Prettier formatting

**Manual workflow** (if needed):

```bash
# Format all files
npm run format

# Check linting
npm run lint
npm run lint:sol

# Run tests
npm test
```

**Skip hooks** (emergency only):

```bash
git commit --no-verify -m "emergency fix"
```

### TypeScript

- Use strict typing (`typescript@5.6.2`)
- TypeChain auto-generates types from contracts
- Generated types in `typechain-types/`

### Solidity

- Version: `0.8.24`
- Style: Follow OpenZeppelin conventions
- Max line length: 140 characters
- Max function complexity: 8
- Max function lines: 100

## Testing

### Test Structure

```
test/
├── CAPToken.test.ts              # Core functionality (token, taxes, minting)
├── Security.test.ts              # Access control, reentrancy, overflow
├── EdgeCases.test.ts             # Boundary conditions, special cases
├── AdvancedSecurity.test.ts      # EIP-2612 permits, storage collisions
├── Checkpoints.test.ts           # Vote checkpointing
├── Invariants.test.ts            # Protocol invariants
├── TimelockBoundary.test.ts      # Timelock edge cases
└── integration/
    ├── DAO-Integration.test.ts   # Aragon OSx integration
    └── MainnetFork.test.ts       # Mainnet fork testing
```

### Test Coverage Goals

- **Line coverage**: > 95%
- **Branch coverage**: > 90%
- **Function coverage**: 100%

### Writing Tests

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Feature", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("CAPToken");
    const contract = await Contract.deploy();
    return { contract, owner, user };
  }

  it("should do something", async function () {
    const { contract, user } = await loadFixture(deployFixture);
    await expect(contract.connect(user).someFunction()).to.emit(contract, "SomeEvent").withArgs(expectedValue);
  });
});
```

## Deployment

### Testnet Deployment (Sepolia)

```bash
# 1. Configure .env with Sepolia settings
# 2. Deploy contract
npm run deploy:sepolia

# 3. Verify on Etherscan
npm run verify:sepolia

# 4. Configure (add pools, update settings)
POOL_ADDRESS=0x... npm run configure:sepolia
```

### Mainnet Deployment

```bash
# ⚠️  PRODUCTION DEPLOYMENT - REVIEW CAREFULLY

# 1. Double-check .env mainnet configuration
# 2. Ensure owner = DAO governance address
# 3. Ensure fee recipient = Treasury Safe address

# Deploy
npm run deploy:mainnet

# Verify
npm run verify:mainnet

# Configure
npm run configure:mainnet
```

### Upgrade Contracts

```bash
# Upgrade to new implementation
npm run upgrade:sepolia
npm run upgrade:mainnet
```

## CI/CD

### GitHub Actions Workflows

This project uses GitHub Actions for continuous integration:

#### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request:

1. **Lint Job**
   - Prettier formatting check
   - ESLint for TypeScript
   - Solhint for Solidity

2. **Test Job**
   - Compile contracts
   - Run unit tests
   - Run security tests
   - Run edge case tests
   - Run integration tests

3. **Coverage Job**
   - Generate coverage report
   - Upload to Codecov (if configured)

4. **Gas Report Job** (PRs only)
   - Generate gas usage report
   - Post as PR comment

5. **Build Job**
   - Verify successful compilation
   - Upload build artifacts

### Status Badges

The CI status and test results are shown in the README.md badges.

### Required Checks

Before merging PRs, ensure:

- ✅ All tests pass
- ✅ Linting passes
- ✅ Formatting is correct
- ✅ Coverage remains high
- ✅ Gas usage is reasonable

## Best Practices

### Git Workflow

1. Create feature branch from `main`
2. Make changes
3. Run quality checks: `npm run format && npm run lint && npm test`
4. Commit with descriptive message
5. Push and create PR
6. Wait for CI to pass
7. Request review
8. Merge after approval

### Commit Messages

Follow conventional commits:

```
feat: add new tax exemption feature
fix: resolve reentrancy in transfer function
test: add checkpoint boundary tests
docs: update deployment guide
chore: upgrade dependencies
```

### Security

- Never commit `.env` file
- Never commit private keys
- Run security tests before deployment
- Get professional audit before mainnet
- Use multi-sig for ownership transfers

### Code Review Checklist

- [ ] Tests cover new functionality
- [ ] No security vulnerabilities
- [ ] Gas optimization considered
- [ ] Documentation updated
- [ ] Linting passes
- [ ] Coverage maintained

## Troubleshooting

### Common Issues

**Issue**: `npm install` fails with peer dependency conflicts

```bash
# Solution: Use legacy peer deps
npm install --legacy-peer-deps
```

**Issue**: Tests fail with "insufficient funds"

```bash
# Solution: Reset local Hardhat network
# Stop node (Ctrl+C) and restart
npm run node
```

**Issue**: TypeChain types not generated

```bash
# Solution: Rebuild contracts
npm run clean && npm run build
```

**Issue**: Linting errors

```bash
# Solution: Auto-fix most issues
npm run lint:fix
npm run format
```

**Issue**: Foundry tests fail with "Source forge-std/Test.sol not found"

```bash
# Solution: Initialize git submodules
git submodule update --init --recursive

# Verify submodule is present
ls lib/forge-std/src/Test.sol

# If still failing, reinstall Foundry
foundryup
```

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [TypeChain Documentation](https://github.com/dethcrypto/TypeChain)
- [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/cyberia-to/cyberia-token/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cyberia-to/cyberia-token/discussions)
- **Documentation**: See `docs/` folder
