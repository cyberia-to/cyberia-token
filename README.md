# Cyberia (CAP) Token

[![Tests](https://img.shields.io/badge/Tests-250%2F250%20Passing-brightgreen)](#testing) [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-green)](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE) [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange)](contracts/CAPToken.sol)

Upgradeable governance ERC-20 token with configurable tax system for Aragon OSx DAO.

## Features

- **ERC-20 Standard**: Full EIP-20 compliance with EIP-2612 Permit & ERC-20 Votes
- **UUPS Upgradeable**: OpenZeppelin upgradeable pattern with DAO-controlled upgrades
- **Configurable Tax System**: Transfer/buy/sell taxes (max 5% each, 8% combined) with 24h timelock
- **AMM Integration**: Pool detection for Uniswap and other DEXs
- **Burn Mechanism**: Token burning and optional burn mode for taxes
- **Bridging Ready**: Governance-gated minting (max 10B supply) for future OFT/LayerZero bridging
- **DAO Governance**: Aragon OSx integration with token-voting plugin

## Deployed Contracts

### Sepolia Testnet

| Component               | Address                                      | Link                                                                                                                                |
| ----------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Token Proxy**         | `0xA6B680A88c16056de7194CF775D04A45D0692C11` | [Etherscan](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11)                                        |
| **Implementation**      | `0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623` | [Etherscan](https://sepolia.etherscan.io/address/0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623)                                        |
| **Governance**          | `0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0` | [Aragon DAO](https://app.aragon.org/dao/ethereum-sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0) - Token governance transferred |
| **Fee Recipient**       | `0x37Bb361F12D10F31a963033e1D0B3bb3026D6654` | Treasury wallet                                                                                                                     |
| **Aragon DAO**          | `0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0` | [Aragon App](https://app.aragon.org/dao/ethereum-sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0) - ✅ Active                    |
| **Token Voting Plugin** | `0xf1a054C12659D65892a2b0c4c5136A93b8a5F115` | [Etherscan](https://sepolia.etherscan.io/address/0xf1a054C12659D65892a2b0c4c5136A93b8a5F115) - Token voting enabled                 |
| **Gnosis Safe**         | Not deployed yet                             | Pending setup (required for treasury operations)                                                                                    |
| **AMM Pool**            | Not deployed yet                             | Pending setup                                                                                                                       |

**Deployment**: October 17, 2025 | **TX**: [0x2ef3e...509ab](https://sepolia.etherscan.io/tx/0x2ef3ed1760d42d0fd73bcad5498ea43deb5db0b280fe08edc7c81778975509ab) | **Block**: 7393742

**Version**: v1.0.0 | **Status**: ✅ Verified | ✅ DAO Active | ⚠️ Not audited

**Completed Steps:**

1. ✅ Deployed CAP token with UUPS upgradeable pattern
2. ✅ Created Aragon DAO with token-voting plugin
3. ✅ Transferred governance to DAO (all admin functions require DAO proposals)
4. ✅ Delegated tokens (1B CAP voting power active)

**Remaining Steps:**

1. Deploy Gnosis Safe for treasury management
2. Configure Zodiac Roles module for board permissions
3. Create AMM liquidity pool (Uniswap V3 or V4)
4. Transfer fee recipient to Safe (via DAO proposal)
5. Conduct security audit before mainnet deployment

### Mainnet

Not deployed yet. Production deployment requires security audit.

## Quick Start

```bash
# Clone repository
git clone --recurse-submodules https://github.com/cyberia-to/cyberia-token.git
cd cyberia-token

# Install dependencies
npm install

# Run tests
npm test                     # Run all tests (250 passing: 144 Hardhat + 106 Foundry)
npm run test:coverage        # Generate coverage report

# Deploy to testnet
cp .env.example .env         # Configure environment variables
npm run deploy:sepolia       # Deploy to Sepolia
npm run verify:sepolia       # Verify on Etherscan
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

### Environment Configuration

```bash
# .env file
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
SEPOLIA_OWNER_ADDRESS=0x...      # Initial governance address (deployer, then transfer to DAO)
SEPOLIA_FEE_RECIPIENT=0x...      # Treasury address
```

### Deploy Commands

| Network | Command                  |
| ------- | ------------------------ |
| Sepolia | `npm run deploy:sepolia` |
| Mainnet | `npm run deploy:mainnet` |

### Post-Deployment

```bash
npm run verify:sepolia           # Verify contract on Etherscan
npm run configure:sepolia        # Configure pools and settings
```

## Testing

### Hardhat Tests

```bash
npm test                    # All 144 comprehensive tests (6 pending)
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

#### Hardhat Tests (144 tests passing, 6 pending)

- **Unit Tests** (60 tests): Core functionality, deployment, tax system, minting, burning, access control, checkpoints, edge cases
- **Security Tests** (52 tests): Reentrancy protection, attack vectors, upgrade safety, permit signatures, timelock boundaries
- **Integration Tests** (32 tests): DAO integration, Zodiac Safe integration, mainnet fork, invariants, delegation
- **Pending Tests** (6 tests): Zodiac Safe integration scenarios requiring Safe deployment

#### Foundry Tests (106 tests)

- **Unit Tests** (41 tests): Timelock, permit, events, edge cases, admin functions
- **Advanced Tests** (19 tests): UUPS upgrades, reentrancy protection, DEX integration, stress testing
- **Fuzz Tests** (16 tests): Random input testing for edge cases and property validation
- **Stateful Tests** (15 tests): Multi-step complex scenarios with state transitions
- **Invariant Tests** (15 tests): Mathematical invariants under all conditions (128K calls per run)

**Total Coverage**: 250 tests (144 Hardhat + 106 Foundry) ensuring comprehensive coverage of all contract functionality and security properties

## Contract Administration

Governance-only functions (DAO controlled):

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
proposeMint(address to, uint256 amount)            // Propose minting (max supply: 10B)
executeMint()                                      // Execute after 7d timelock
cancelMint()                                       // Cancel pending mint
upgradeToAndCall(address newImpl, bytes data)      // UUPS upgrade
```

## DAO Integration

### Aragon OSx - Setup via UI

**Create DAO**: https://app.aragon.org

1. Create new DAO via Aragon App
2. Install Token Voting plugin
3. Import your deployed CAP token address
4. Configure voting parameters (example below)
5. Deploy DAO
6. Save DAO address and plugin address to `.env`

**Example Token Voting Configuration**:

```javascript
{
  token: "0xYourCAPTokenAddress",
  supportThreshold: "500000",      // 50%
  minParticipation: "150000",      // 15%
  minDuration: 86400,              // 24h (1 day)
  minProposerVotingPower: "10000000000000000000000"  // 10,000 CAP
}
```

**After DAO Creation**:

```bash
# 1. Transfer token governance to DAO
npm run dao:transfer-governance

# 2. Delegate your tokens for voting power
npm run dao:delegate

# 3. Query DAO status
npm run dao:info

# 4. Create and manage proposals via Aragon UI
# Visit: https://app.aragon.org/dao/ethereum-sepolia/[YOUR_DAO_ADDRESS]
```

**Managing Proposals**: Use the Aragon App UI at https://app.aragon.org to create, vote on, and execute proposals. The UI provides a user-friendly interface for all governance operations.

### Gnosis Safe + Zodiac - Setup via UI (Required)

**Deploy Safe**: https://app.safe.global

1. Create Safe with board members (3-5 owners, 2-of-3 threshold)
2. Install Zodiac Roles Module via Safe Apps
3. Import role configuration from [docs/zodiac-roles-config.json](docs/zodiac-roles-config.json)
4. Create DAO proposal to set Safe as fee recipient
5. Test treasury operations

**Zodiac Roles Configuration** ([docs/zodiac-roles-config.json](docs/zodiac-roles-config.json)):

- **BOARD_DAILY_OPS**: Small transfers (<50k CAP) by board
- **BOARD_MEDIUM_OPS**: Medium transfers (50k-200k CAP) with 2-of-3
- **DAO_LARGE_OPS**: Large transfers (>200k CAP) require DAO vote
- **DAO_TOKEN_ADMIN**: All admin functions (taxes, pools, upgrades) DAO-only

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

## Documentation

- [DAO Scripts Guide](docs/dao-scripts-guide.md) - Complete reference for all DAO operations with examples and troubleshooting
- [Zodiac Roles Config](docs/zodiac-roles-config.json) - Production-ready policy enforcing "Board + DAO" governance (import via Safe UI)

## Security

### Security Features

- ✅ Reentrancy protection on all transfers
- ✅ 24-hour timelock on tax changes (prevents front-running)
- ✅ Max supply cap (10B tokens)
- ✅ OpenZeppelin audited contracts
- ✅ UUPS upgradeable pattern

### Security Status

⚠️ **Not audited**. Professional security audit required before mainnet deployment.

## License

MIT

---

**Built for Cyberia ecosystem**
