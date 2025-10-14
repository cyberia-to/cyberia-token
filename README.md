# Cyberia (CAP) Token

[![Tests](https://img.shields.io/badge/Tests-99%2F99%20Passing-brightgreen)](#testing) [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-green)](https://sepolia.etherscan.io/address/0xA419fD4e3BA375250d5D946D91262769F905aEED) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE) [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange)](contracts/CAPToken.sol)

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
# Install
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
- **Supply**: 1,000,000,000 (fixed)
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
npm run verify:sepolia <PROXY_ADDRESS>
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
npm test                    # All 126 comprehensive tests
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

#### Hardhat Tests (126 tests)

- **Unit Tests**: Core functionality (deployment, tax system, minting, burning)
- **Security Tests**: Access control, attack vectors, upgrade safety
- **Integration Tests**: DAO integration, mainnet fork, invariants, checkpoints

#### Foundry Tests (Property-based)

- **Fuzz Tests**: Random input testing for edge cases
- **Invariant Tests**: Mathematical invariants under all conditions
- **Stateful Tests**: Multi-step complex scenarios

**Coverage Areas**: Reentrancy protection, permit signatures, upgrade safety, max supply, timelock, tax calculations

## Contract Administration

Owner-only functions (DAO governance):

### Tax Management (with 24h Timelock)

```solidity
// Propose new tax rates (requires 24h delay before applying)
proposeTaxChange(uint256 transfer, uint256 sell, uint256 buy)

// Apply pending tax changes after 24h delay
applyTaxChange()

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
3. Configure roles for treasury management
4. Validate configuration: `npm run validate:zodiac`
5. Set Safe as fee recipient

See [Zodiac configuration example](docs/DEPLOYMENT.md#zodiac-roles-configuration).

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

- **Proxy**: [`0xA419fD4e3BA375250d5D946D91262769F905aEED`](https://sepolia.etherscan.io/address/0xA419fD4e3BA375250d5D946D91262769F905aEED)
- **Status**: Verified ✅

### Mainnet

- Not deployed yet

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Setup, workflow, testing, CI/CD
- [Governance Guide](docs/GOVERNANCE.md) - Tax management, timelock workflow
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment procedures
- [Quick Start](docs/QUICK_START.md) - Get started quickly
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

### Recent Security Improvements

- Added `ReentrancyGuard` to prevent reentrancy attacks
- Implemented timelock mechanism for tax changes
- Added maximum supply protection
- Fixed pool-to-pool transfer logic
- Enhanced event system for better monitoring

## License

MIT

---

**Built for Cyberia ecosystem**
