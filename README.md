# Cyberia (CAP) Token

[![Tests](https://img.shields.io/badge/Tests-200%20Passing-brightgreen)](#testing) [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-green)](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE) [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange)](contracts/CAPToken.sol)

Upgradeable governance ERC-20 token with configurable tax system for Aragon OSx DAO.

## Features

- **ERC-20 Standard**: Full EIP-20 compliance with EIP-2612 Permit & ERC-20 Votes
- **UUPS Upgradeable**: OpenZeppelin upgradeable pattern with DAO-controlled upgrades
- **Configurable Tax System**: Transfer/buy/sell taxes (max 5% each, 8% combined) with 24h timelock
- **AMM Integration**: Pool detection for Uniswap and other DEXs
- **Burn Mechanism**: Token burning (on CAPToken) and optional burn mode for taxes. OFT burn restricted to LayerZero endpoint only (security)
- **Bridging Ready**: Governance-gated minting (max 10B supply) for future OFT/LayerZero bridging
- **DAO Governance**: Aragon OSx integration with token-voting plugin

## Omnichain Bridging (LayerZero V2 OFT)

**Status**: ✅ **Testnet Deployed** (Sepolia ↔ Arbitrum Sepolia)

**Architecture**: Production-ready LayerZero V2 OFT integration with proper fee-on-transfer handling.

**Contracts**:

- `CAPTokenOFTAdapter.sol` (211 lines) - Locks/unlocks CAP tokens on Ethereum mainnet
- `CAPTokenOFT.sol` (104 lines) - Mints/burns on destination chains (Arbitrum, Optimism, Base, Polygon)

**Key Features**:

- ✅ Pre/post balance checks for fee-on-transfer compatibility
- ✅ Supply invariant maintained across all chains (X locked = X minted)
- ✅ Slippage protection with configurable limits (default 5%, owner-adjustable)
- ✅ Fee recipient validation (prevents setting contract as recipient)
- ✅ Burn functions restricted to LayerZero endpoint (OFT security)
- ✅ Official `@layerzerolabs/oft-evm` base contracts
- ✅ Comprehensive NatSpec documentation
- ✅ Full test coverage (200 Hardhat tests passing)

**Bridge Fee**:

- 💰 **1% fee per bridge operation** (transfer tax)
- Fee applies to both bridging OUT (ETH → L2) and IN (L2 → ETH)
- Revenue goes to DAO treasury
- Intentional design to concentrate liquidity on mainnet

**Supported Chains**:

- Ethereum (mainnet/Sepolia) - OFTAdapter
- Arbitrum (One/Sepolia) - OFT
- Optimism (mainnet/Sepolia) - OFT
- Base (mainnet/Sepolia) - OFT
- Polygon (PoS/Amoy) - OFT

**Testnet Deployments**:

- ✅ Sepolia OFTAdapter: `0xf3d4e50Cb073d707d54Af96d157183e561212F4F`
- ✅ Arbitrum Sepolia OFT: `0x073a66b4136A6b62AbAb0914D9540b1808D01526`

**Next Steps**:

1. ✅ Deploy to testnet (Sepolia ↔ Arbitrum Sepolia) - COMPLETE
2. Test cross-chain bridging functionality
3. Deploy to additional testnets (Optimism Sepolia, Base Sepolia)
4. Security audit before mainnet deployment

## Deployed Contracts

### Sepolia Testnet

| Component               | Address                                      | Link                                                                                                                                |
| ----------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Token Proxy**         | `0xA6B680A88c16056de7194CF775D04A45D0692C11` | [Etherscan](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11)                                        |
| **Implementation**      | `0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623` | [Etherscan](https://sepolia.etherscan.io/address/0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623)                                        |
| **OFT Adapter**         | `0xf3d4e50Cb073d707d54Af96d157183e561212F4F` | [Etherscan](https://sepolia.etherscan.io/address/0xf3d4e50Cb073d707d54Af96d157183e561212F4F) - LayerZero bridging                   |
| **Governance**          | `0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0` | [Aragon DAO](https://app.aragon.org/dao/ethereum-sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0) - Token governance transferred |
| **Fee Recipient**       | `0x37Bb361F12D10F31a963033e1D0B3bb3026D6654` | Treasury wallet                                                                                                                     |
| **Aragon DAO**          | `0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0` | [Aragon App](https://app.aragon.org/dao/ethereum-sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0) - ✅ Active                    |
| **Token Voting Plugin** | `0xf1a054C12659D65892a2b0c4c5136A93b8a5F115` | [Etherscan](https://sepolia.etherscan.io/address/0xf1a054C12659D65892a2b0c4c5136A93b8a5F115) - Token voting enabled                 |
| **Gnosis Safe**         | Not deployed yet                             | Pending setup (required for treasury operations)                                                                                    |
| **AMM Pool**            | Not deployed yet                             | Pending setup                                                                                                                       |

**Deployment**: October 17, 2025 | **TX**: [0x2ef3e...509ab](https://sepolia.etherscan.io/tx/0x2ef3ed1760d42d0fd73bcad5498ea43deb5db0b280fe08edc7c81778975509ab) | **Block**: 7393742

### Arbitrum Sepolia Testnet

| Component   | Address                                      | Link                                                                                                          |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **CAP OFT** | `0x073a66b4136A6b62AbAb0914D9540b1808D01526` | [Arbiscan](https://sepolia.arbiscan.io/address/0x073a66b4136A6b62AbAb0914D9540b1808D01526) - LayerZero bridge |

**Deployment**: October 21, 2025 | **Status**: ✅ Verified | ⚠️ Not audited

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
npm test                     # Hardhat tests (200 passing)
npm run test:foundry         # Foundry tests (106 passing)
npm run test:all             # All tests (306 passing: 200 Hardhat + 106 Foundry)
npm run test:ci              # Full CI validation (linters + all tests)
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

The token implements a hybrid tax system with three independent tax parameters:

| Tax Type         | Applied When           | Default Rate | Individual Cap |
| ---------------- | ---------------------- | ------------ | -------------- |
| **Transfer Tax** | User → User (non-pool) | 1% (100 bp)  | 5% (500 bp)    |
| **Sell Tax**     | User → Pool (AMM sell) | 1% (100 bp)  | 5% (500 bp)    |
| **Buy Tax**      | Pool → User (AMM buy)  | 0% (0 bp)    | 5% (500 bp)    |

### How Taxes Are Applied

| Transaction Type    | From → To   | Taxes Applied                    | Total Tax (Default) |
| ------------------- | ----------- | -------------------------------- | ------------------- |
| Peer-to-peer        | User → User | Transfer tax only                | 1%                  |
| AMM Sell            | User → Pool | Transfer tax + Sell tax (hybrid) | 2%                  |
| AMM Buy             | Pool → User | Buy tax only                     | 0%                  |
| Liquidity Migration | Pool → Pool | No taxes                         | 0%                  |

### Tax Safety Limits

- **Individual cap**: Each tax type limited to 5% (500 bp)
- **Sell scenario cap**: Transfer + Sell ≤ 8% (800 bp)
- **Global cap**: Any two taxes combined ≤ 10% (1000 bp)
- **Timelock**: All tax changes require 24-hour delay (no emergency override)
- **Pool exemption**: Pool-to-pool transfers always tax-free for AMM operations

### Tax Distribution

- Fees go to configurable `feeRecipient` address (treasury/Safe)
- Setting `feeRecipient` to `0x0` enables burn mode (reduces supply)
- Canonical ERC-20 burn events emitted for proper supply tracking

## Deployment

### Environment Configuration

```bash
# .env file - Core Configuration
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
SEPOLIA_OWNER_ADDRESS=0x...      # Initial governance address (deployer, then transfer to DAO)
SEPOLIA_FEE_RECIPIENT=0x...      # Treasury address

# LayerZero OFT Configuration (for cross-chain bridging)
TESTNET_OWNER_ADDRESS=0x...      # Single owner address for all testnets (Sepolia, Arbitrum Sepolia, etc.)
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
# Network-specific addresses override TESTNET_OWNER_ADDRESS if needed
```

**Note**: Use `TESTNET_OWNER_ADDRESS` to set the same owner across all testnet deployments. Network-specific variables (e.g., `ARBITRUM_SEPOLIA_OWNER_ADDRESS`) will override this if set.

### Deploy Commands

#### CAP Token

| Network | Command                  |
| ------- | ------------------------ |
| Sepolia | `npm run deploy:sepolia` |
| Mainnet | `npm run deploy:mainnet` |

#### LayerZero OFT (Cross-chain Bridging)

| Command                       | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| `npm run oft:deploy:adapter`  | Deploy OFTAdapter on Ethereum/Sepolia                  |
| `npm run oft:deploy:oft`      | Deploy OFT on destination chain (Arbitrum, Optimism)   |
| `npm run oft:configure:peers` | Configure peer connections between chains              |
| `npm run oft:check-balance`   | Check CAP token balance on destination chain           |
| `npm run oft:check-peers`     | Verify peer configurations and detect stale settings   |
| `npm run oft:test-bridge`     | Test bridging tokens cross-chain (requires deployment) |

### Post-Deployment

```bash
npm run verify:sepolia           # Verify contract on Etherscan
npm run configure:sepolia        # Configure pools and settings

# For LayerZero deployments
npm run oft:configure:peers      # Set up peer connections
npm run oft:check-peers          # Verify configuration
```

## Testing

### Combined Test Suites (Recommended)

```bash
npm run test:all            # Run all tests (306 passing: 200 Hardhat + 106 Foundry)
npm run test:ci             # Full CI validation (linters + all tests)
```

### Hardhat Tests

```bash
npm test                    # All Hardhat tests (200 passing)
npm run test:unit           # Unit tests
npm run test:security       # Security tests
npm run test:integration    # Integration tests
npm run test:coverage       # Coverage report
npm run test:gas            # Gas usage report
```

### Foundry Tests (Fuzz & Invariant)

```bash
npm run test:foundry              # All Foundry tests (106 passing)
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

#### Hardhat Tests (200 tests passing)

- **Unit Tests** (70+ tests): Core functionality, deployment, tax system, minting, burning, access control, checkpoints, edge cases, rolling mint window
- **Security Tests** (50+ tests): Reentrancy protection, attack vectors, upgrade safety, permit signatures, timelock boundaries, fee recipient validation
- **Integration Tests** (35+ tests): DAO integration, Zodiac Safe integration, mainnet fork, invariants, delegation, state consistency
- **LayerZero Tests** (50+ tests): OFTAdapter integration, fee-on-transfer handling, cross-chain supply invariants, peer configuration, slippage protection

#### Foundry Tests (106 tests)

- **Unit Tests** (41 tests): Timelock, permit, events, edge cases, admin functions
- **Advanced Tests** (19 tests): UUPS upgrades, reentrancy protection, DEX integration, stress testing
- **Fuzz Tests** (16 tests): Random input testing for edge cases and property validation
- **Stateful Tests** (15 tests): Multi-step complex scenarios with state transitions
- **Invariant Tests** (15 tests): Mathematical invariants under all conditions (128K calls per run)

**Total Coverage**: 306 tests (200 Hardhat + 106 Foundry) ensuring comprehensive coverage of all contract functionality, cross-chain bridging, security improvements, and property validation

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
```

**Tax Limits**:

- Individual: Max 500 bp (5%) per tax type
- Sell scenario: transfer + sell ≤ 800 bp (8%)
- Global: Any two taxes ≤ 1000 bp (10%)

**Note**: All tax changes require a 24-hour timelock with no emergency override. This protects token holders from sudden tax increases.

### Other Admin Functions

```solidity
addPool(address pool)                              // Add AMM pool address
removePool(address pool)                           // Remove AMM pool
setFeeRecipient(address recipient)                 // 0x0 = burn mode (cannot be contract address)
proposeMint(address to, uint256 amount)            // Propose minting (max 100M/30-day rolling window, 10B total)
executeMint()                                      // Execute after 7d timelock
cancelMint()                                       // Cancel pending mint
upgradeToAndCall(address newImpl, bytes data)      // UUPS upgrade
```

**OFTAdapter Functions** (LayerZero V2):

```solidity
setMaxInboundSlippage(uint256 _newSlippageBp)     // Configure max slippage for inbound transfers (default 5%, max 100%)
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
- ✅ 30-day rolling window mint cap (100M per period) to prevent flash minting attacks
- ✅ Fee recipient validation (prevents setting contract as recipient)
- ✅ OFT burn functions restricted to LayerZero endpoint (prevents unauthorized burning)
- ✅ Slippage protection on inbound transfers (default 5%, configurable by owner)
- ✅ Max supply cap (10B tokens)
- ✅ OpenZeppelin audited contracts
- ✅ UUPS upgradeable pattern

### Security Status

⚠️ **Not audited**. Professional security audit required before mainnet deployment.

## License

MIT

---

**Built for Cyberia ecosystem**
