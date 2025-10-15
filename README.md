# Cyberia (CAP) Token

[![Tests](https://img.shields.io/badge/Tests-256%2F256%20Passing-brightgreen)](#testing) [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-green)](https://sepolia.etherscan.io/address/0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE) [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange)](contracts/CAPToken.sol)

Upgradeable governance ERC-20 token with configurable tax system for Aragon OSx DAO.

## Features

- ERC-20 with EIP-2612 Permit & ERC-20 Votes
- UUPS Upgradeable (OpenZeppelin)
- Configurable tax system (transfer/buy/sell, max 5% each, 8% combined)
- AMM pool detection
- Burn mechanism
- Owner-gated minting for future OFT bridging

## Quick Start

```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/cyberia-to/cyberia-token.git
cd cyberia-token

# OR if you already cloned without --recurse-submodules
git submodule update --init --recursive

# Install dependencies
npm install

# Install Foundry (optional, for fuzz/invariant tests)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Code Quality
npm run format               # Format code
npm run lint                 # Lint TypeScript
npm run lint:sol             # Lint Solidity

# Test
npm test                     # Run all Hardhat tests
npm run test:foundry         # Run Foundry tests (requires Foundry)
npm run test:coverage        # Generate coverage

# Deploy localhost
npm run node                 # Terminal 1
npm run deploy:localhost     # Terminal 2

# Deploy testnet/mainnet
cp .env.example .env         # Configure first
npm run deploy:sepolia
npm run deploy:mainnet
```

## Token Info

- **Name**: Cyberia
- **Symbol**: CAP
- **Initial Supply**: 1,000,000,000 (1 billion)
- **Max Supply**: 10,000,000,000 (10 billion, for bridging/OFT)
- **Decimals**: 18

## Tax System

| Type          | From → To   | Default Rate               | Notes                            |
| ------------- | ----------- | -------------------------- | -------------------------------- |
| Transfer      | User → User | 1%                         | Standard peer-to-peer            |
| Sell          | User → Pool | 2% (1% transfer + 1% sell) | AMM sell                         |
| Buy           | Pool → User | 0%                         | AMM buy (default)                |
| Pool Transfer | Pool → Pool | 0%                         | Tax-free for liquidity migration |

### Tax Details

- Fees go to treasury or burn (if recipient = `0x0`)
- Max 5% per individual tax type
- Max 8% combined (transfer + sell)
- 24-hour timelock required for tax changes
- Pool-to-pool transfers are tax-exempt to facilitate AMM operations

## Deployment

### Environments

| Network   | Command                    |
| --------- | -------------------------- |
| Localhost | `npm run deploy:localhost` |
| Sepolia   | `npm run deploy:sepolia`   |
| Mainnet   | `npm run deploy:mainnet`   |

### Setup

```bash
# Configure .env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
SEPOLIA_OWNER_ADDRESS=0x...      # DAO address
SEPOLIA_FEE_RECIPIENT=0x...      # Treasury address
```

### Deploy & Verify

```bash
npm run deploy:sepolia
npm run verify:sepolia  # Automatically detects proxy address from deployments.json
```

### Configure

```bash
# Addresses auto-detected from deployments.json
POOL_ADDRESS=0x... npm run configure:sepolia
NEW_FEE_RECIPIENT=0x... npm run configure:sepolia
```

## Testing

### Hardhat Tests

```bash
npm test                    # All 151 comprehensive tests
npm run test:unit           # Unit tests
npm run test:security       # Security tests
npm run test:integration    # Integration tests
npm run test:coverage       # Coverage report
npm run test:gas            # Gas usage report
```

### Foundry Tests (Fuzz & Invariant)

```bash
npm run test:foundry              # All Foundry tests
npm run test:foundry:fuzz         # Fuzz testing
npm run test:foundry:invariant    # Invariant testing
npm run test:foundry:stateful     # Stateful testing
npm run test:foundry:coverage     # Foundry coverage
npm run test:foundry:gas          # Foundry gas report
```

### Other Validation

```bash
npm run validate:zodiac     # Validate Zodiac roles config
```

### Test Suite Breakdown

#### Hardhat Tests (151 tests)

- **Unit Tests** (62 tests): Core functionality, deployment, tax system, minting, burning, access control, checkpoints, edge cases
- **Security Tests** (57 tests): Reentrancy protection, attack vectors, upgrade safety, permit signatures, timelock boundaries
- **Integration Tests** (75 tests): DAO integration, Zodiac Safe integration, mainnet fork, invariants, delegation

#### Foundry Tests (105 tests)

- **Unit Tests** (41 tests): Timelock, permit, events, edge cases, admin functions
- **Advanced Tests** (19 tests): UUPS upgrades, reentrancy protection, DEX integration, stress testing
- **Fuzz Tests** (16 tests): Random input testing for edge cases and property validation
- **Stateful Tests** (14 tests): Multi-step complex scenarios with state transitions
- **Invariant Tests** (15 tests): Mathematical invariants under all conditions (128K calls per run)

**Total Coverage**: 256 tests ensuring comprehensive coverage of all contract functionality and security properties

## Contract Administration

Owner-only functions (DAO governance):

### Tax Management (with 24h Timelock)

```solidity
// Propose new tax rates (requires 24h delay before applying)
proposeTaxChange(uint256 transfer, uint256 sell, uint256 buy)

// Apply pending tax changes after 24h delay
applyTaxChange()

// Cancel pending tax change before it takes effect
cancelTaxChange()

// Emergency: Set taxes immediately (use with caution)
setTaxesImmediate(uint256 transfer, uint256 sell, uint256 buy)
```

**Tax Limits**: Max 500 bp (5%) each, combined transfer+sell ≤ 800 bp (8%)

### Other Admin Functions

```solidity
addPool(address pool)                              // Add AMM pool address
removePool(address pool)                           // Remove AMM pool
setFeeRecipient(address recipient)                 // 0x0 = burn mode
mint(address to, uint256 amount)                   // Max supply: 10B tokens
upgradeToAndCall(address newImpl, bytes data)      // UUPS upgrade
```

## DAO Integration

### Aragon OSx

```javascript
// Token-Voting Plugin Config
{
  token: "<CAP_ADDRESS>",
  supportThreshold: "500000",      // 50%
  minParticipation: "150000",      // 15%
  minDuration: 86400,              // 24h
  minProposerVotingPower: "10000000000000000000000"  // 10k CAP
}
```

Transfer ownership:

```solidity
capToken.transferOwnership(DAO_ADDRESS);
```

### Gnosis Safe + Zodiac

1. Deploy Safe with board members
2. Install Zodiac Roles Module
3. Configure roles for treasury management (using [docs/zodiac-roles-config.json](docs/zodiac-roles-config.json))
4. Validate configuration: `npm run validate:zodiac`
5. Set Safe as fee recipient

**Zodiac Roles Configuration**: The repository includes a production-ready Zodiac Roles policy in [docs/zodiac-roles-config.json](docs/zodiac-roles-config.json) that enforces "Board + DAO" governance rules:

- **BOARD_DAILY_OPS**: Small transfers (<50k CAP) by board members
- **BOARD_MEDIUM_OPS**: Medium transfers (50k-200k CAP) with higher threshold
- **DAO_LARGE_OPS**: Large transfers (>200k CAP) require DAO governance approval
- **DAO_TOKEN_ADMIN**: All token admin functions (taxes, pools, upgrades) restricted to DAO

See [full deployment guide](docs/DEPLOYMENT.md#zodiac-roles-configuration) and [Safe setup guide](docs/safe-setup-guide.md).

## Architecture

```
Token Owner (Aragon DAO)
    ↓
Gnosis Safe (Treasury)
    ↓
Zodiac Roles Module
    ↓
Board Members
```

## Deployed Contracts

### Sepolia Testnet

- **Proxy**: [`0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e`](https://sepolia.etherscan.io/address/0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e)
- **Implementation (v1.1.0)**: [`0x7e2c2d1eC3f3f181640a3F1894A0299D6D5f46Ad`](https://sepolia.etherscan.io/address/0x7e2c2d1eC3f3f181640a3F1894A0299D6D5f46Ad)
- **Aragon DAO**: [`0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33`](https://app.aragon.org/#/daos/sepolia/0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33)
- **Governance Plugin**: [`0x295878F28f403EE6e6C6b4474e8E123022063b24`](https://sepolia.etherscan.io/address/0x295878F28f403EE6e6C6b4474e8E123022063b24)
- **Status**: Verified ✅ - Upgraded 10/15/2025 | DAO Governance Active ✅
- **Changes**: Added `cancelTaxChange()` function, fixed Zodiac config, transferred ownership to DAO

### Mainnet

- Not deployed yet

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Setup, workflow, testing, CI/CD
- [Governance Guide](docs/GOVERNANCE.md) - Tax management, timelock workflow
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment procedures
- [Deployment Workflows](docs/DEPLOYMENT_WORKFLOWS.md) - GitHub Actions deployment automation
- [Quick Start](docs/QUICK_START.md) - Get started quickly
- [Foundry Testing](docs/FOUNDRY.md) - Property-based and invariant testing
- [Aragon Integration](docs/aragon-integration.md) - DAO governance integration
- [Safe Setup Guide](docs/safe-setup-guide.md) - Gnosis Safe + Zodiac configuration
- [Contract Source](contracts/CAPToken.sol) - Main contract code

## Security

### Security Features

- ✅ Reentrancy protection on all transfers
- ✅ 24-hour timelock on tax changes (prevents front-running)
- ✅ Max supply cap (10B tokens)
- ✅ OpenZeppelin audited contracts
- ✅ UUPS upgradeable pattern

### Security Status

⚠️ **Not audited**. Professional security audit required before mainnet deployment.

### Recent Improvements

**Security**:

- ✅ Added `ReentrancyGuard` to prevent reentrancy attacks
- ✅ Implemented 24-hour timelock mechanism for tax changes
- ✅ Added maximum supply protection (10B cap)
- ✅ Fixed pool-to-pool transfer logic for DEX compatibility

**Testing**:

- ✅ Expanded test suite from 45 to 256 tests (469% increase)
- ✅ Added comprehensive fuzz testing (16 tests, 256 runs each)
- ✅ Added stateful testing (14 complex scenarios)
- ✅ Added invariant testing (15 properties, 128K calls each)
- ✅ Re-enabled and fixed all previously disabled tests

**Code Quality**:

- ✅ Fixed all ESLint warnings (proper TypeScript types)
- ✅ Fixed Slither CI/CD integration issues
- ✅ Optimized gas reporting workflow
- ✅ Enhanced NatSpec documentation

## License

MIT

---

**Built for Cyberia ecosystem**
