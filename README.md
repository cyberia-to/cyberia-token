# Cyberia (CAP) Token

[![Tests](https://img.shields.io/badge/Tests-82%2F82%20Passing-brightgreen)](#testing) [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-green)](https://sepolia.etherscan.io/address/0xA419fD4e3BA375250d5D946D91262769F905aEED) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE) [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange)](contracts/CAPToken.sol)

Upgradeable governance ERC-20 token with configurable tax system for Aragon OSx DAO.

## Features

- ERC-20 with EIP-2612 Permit & ERC-20 Votes
- UUPS Upgradeable (OpenZeppelin)
- Configurable tax system (transfer/buy/sell, max 5%)
- AMM pool detection
- Burn mechanism

## Quick Start

```bash
# Install
npm install

# Test
npm test

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

| Type | From → To | Default Rate |
|------|-----------|--------------|
| Transfer | User → User | 1% |
| Sell | User → Pool | 2% (1% transfer + 1% sell) |
| Buy | Pool → User | 0% |

Fees go to treasury or burn (if recipient = `0x0`). Max 5% per type.

## Deployment

### Environments

| Network | Command | Auto-detects Address |
|---------|---------|----------------------|
| Localhost | `npm run deploy:localhost` | ✅ |
| Sepolia | `npm run deploy:sepolia` | ✅ |
| Mainnet | `npm run deploy:mainnet` | ✅ |

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

```bash
npm test                    # 82 unit/integration tests
npm run test:localhost      # 14 E2E scenarios
npm run test:coverage       # Coverage report
```

## Contract Administration

Owner-only functions (DAO governance):

```solidity
setTaxes(uint256 transfer, uint256 sell, uint256 buy)  // Max 500 bp each
addPool(address pool)
removePool(address pool)
setFeeRecipient(address recipient)  // 0x0 = burn mode
upgradeToAndCall(address newImpl, bytes data)
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
4. Set Safe as fee recipient

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

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Quick Start](docs/QUICK_START.md)
- [Contract Source](contracts/CAPToken.sol)

## Security

⚠️ **Not audited**. Audit required before mainnet deployment.

## License

MIT

---

**Built for Cyberia ecosystem**
