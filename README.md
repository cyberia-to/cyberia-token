# Cyberia (CAP) Token

[![Tests](https://img.shields.io/badge/Tests-256%2F256%20Passing-brightgreen)](#testing) [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-green)](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE) [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange)](contracts/CAPToken.sol)

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

| Component          | Address                                      | Link                                                                                         |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Token Proxy**    | `0xA6B680A88c16056de7194CF775D04A45D0692C11` | [Etherscan](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11) |
| **Implementation** | `0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623` | [Etherscan](https://sepolia.etherscan.io/address/0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623) |
| **Governance**     | `0x9B9bD768891F014fF72864862EF14f139084992D` | Deployer (temporary - transfer to DAO when ready)                                            |
| **Fee Recipient**  | `0x37Bb361F12D10F31a963033e1D0B3bb3026D6654` | Treasury wallet                                                                              |
| **Aragon DAO**     | Not deployed yet                             | Pending setup                                                                                |
| **Gnosis Safe**    | Not deployed yet                             | Pending setup                                                                                |
| **AMM Pool**       | Not deployed yet                             | Pending setup                                                                                |

**Deployment**: October 17, 2025 | **TX**: [0x2ef3e...509ab](https://sepolia.etherscan.io/tx/0x2ef3ed1760d42d0fd73bcad5498ea43deb5db0b280fe08edc7c81778975509ab) | **Block**: 7393742

**Version**: v1.0.0 | **Status**: ✅ Verified | ⏳ DAO Setup Pending | ⚠️ Not audited

**Next Steps:**

1. Setup Aragon DAO with token-voting plugin
2. Deploy Gnosis Safe for treasury management
3. Configure Zodiac Roles module
4. Transfer governance to DAO
5. Create AMM liquidity pool

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
npm test                     # Run all tests (256 passing)
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

Transfer governance to DAO:

```solidity
capToken.setGovernance(DAO_ADDRESS);
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

See [Aragon Integration Guide](docs/aragon-integration.md) and [Safe Setup Guide](docs/safe-setup-guide.md) for detailed instructions.

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

- [Aragon Integration Guide](docs/aragon-integration.md) - DAO governance integration and token-voting setup
- [Safe Setup Guide](docs/safe-setup-guide.md) - Gnosis Safe + Zodiac Roles configuration
- [Zodiac Roles Config](docs/zodiac-roles-config.json) - Production-ready policy enforcing "Board + DAO" governance

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
