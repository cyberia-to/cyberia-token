# Quick Start Guide - Cyberia (CAP) Token

Get started with the Cyberia token in minutes. This guide covers the essentials for each environment.

## 🚀 Fast Track

### Localhost (Development)

```bash
# 1. Install dependencies
npm install

# 2. Run tests
npm test

# 3. Start local node (optional)
npm run node

# 4. Deploy to localhost (in another terminal)
npm run deploy:localhost
```

### Sepolia Testnet

```bash
# 1. Configure .env
cp .env.example .env
# Edit .env with your settings:
# - SEPOLIA_RPC_URL
# - PRIVATE_KEY
# - SEPOLIA_OWNER_ADDRESS
# - SEPOLIA_FEE_RECIPIENT

# 2. Get test ETH from faucets
# Visit: https://sepoliafaucet.com/

# 3. Deploy
npm run deploy:sepolia

# 4. Verify on Etherscan (auto-detects address)
npm run verify:sepolia
```

### Mainnet (Production)

```bash
# 1. Triple-check .env configuration
# - MAINNET_RPC_URL
# - PRIVATE_KEY (use hardware wallet!)
# - MAINNET_OWNER_ADDRESS (DAO address)
# - MAINNET_FEE_RECIPIENT (Treasury Safe)

# 2. Run all tests
npm run test:all

# 3. Deploy (⚠️ uses real ETH!)
npm run deploy:mainnet

# 4. Verify on Etherscan (auto-detects address)
npm run verify:mainnet
```

---

## 📋 Essential Commands

### Testing

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:security # Security tests
npm run test:coverage # Coverage report
npm run test:gas      # Gas usage report
```

### Building

```bash
npm run build         # Compile contracts
npm run clean         # Clean artifacts
```

### Deployment

```bash
npm run deploy:localhost  # Local deployment
npm run deploy:sepolia    # Sepolia testnet
npm run deploy:mainnet    # Ethereum mainnet
```

### Configuration

```bash
npm run configure:localhost  # Configure localhost
npm run configure:sepolia    # Configure Sepolia
npm run configure:mainnet    # Configure mainnet
```

### Verification

```bash
npm run verify:sepolia  # Verify on Sepolia (auto-detects from deployments.json)
npm run verify:mainnet  # Verify on mainnet (auto-detects from deployments.json)
```

---

## 🔧 Environment Variables

### Required for Localhost

```env
# No configuration needed!
# Localhost automatically uses Hardhat's default test accounts:
#   Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
#   Fee Recipient: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### Required for Sepolia

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
SEPOLIA_OWNER_ADDRESS=0xYourAddress
SEPOLIA_FEE_RECIPIENT=0xYourTreasuryAddress
```

### Required for Mainnet

```env
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_production_key  # ⚠️ Use hardware wallet!
ETHERSCAN_API_KEY=your_etherscan_api_key
MAINNET_OWNER_ADDRESS=0xYourDAOAddress  # ⚠️ Must be DAO governance!
MAINNET_FEE_RECIPIENT=0xYourTreasuryAddress  # ⚠️ Must be Treasury Safe!
```

---

## 🎯 Common Tasks

### Deploy and Configure in One Go

```bash
# Localhost
npm run deploy:localhost && \
  CAP_TOKEN_ADDRESS=<DEPLOYED_ADDRESS> \
  POOL_ADDRESS=<POOL_ADDRESS> \
  npm run configure:localhost

# Sepolia
npm run deploy:sepolia && \
  npm run verify:sepolia && \
  POOL_ADDRESS=<POOL_ADDRESS> \
  npm run configure:sepolia
```

### Check Deployment Status

Deployment details are saved in `deployments.json`. View them:

```bash
cat deployments.json | jq
```

### Add a Pool After Deployment

```bash
# ✨ No need to set CAP_TOKEN_ADDRESS - it's auto-detected!
export POOL_ADDRESS=<UNISWAP_PAIR_ADDRESS>

# Run configuration (automatically finds the right address)
npm run configure:<network>
```

### Update Fee Recipient

```bash
# ✨ No need to set CAP_TOKEN_ADDRESS - it's auto-detected!
export NEW_FEE_RECIPIENT=<NEW_TREASURY_ADDRESS>

# Run configuration (automatically finds the right address)
npm run configure:<network>
```

### 🎯 How Auto-Detection Works

The configuration scripts automatically read from `deployments.json`:

```bash
# Each network has its own tracked address
npm run configure:localhost  → Uses localhost address
npm run configure:sepolia    → Uses sepolia address
npm run configure:mainnet    → Uses mainnet address
```

**No manual address management needed!**

---

## 🛠️ Troubleshooting

### Tests Failing

```bash
# Clean and rebuild
npm run clean
npm run build
npm test
```

### Deployment Fails

```bash
# Check balance
node -e "console.log(require('ethers').formatEther(balance))"

# Check network connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $SEPOLIA_RPC_URL
```

### Verification Fails

```bash
# Wait 1-2 minutes after deployment
sleep 120

# Try again
npm run verify:<network>
```

---

## 📖 Learn More

- **Full Deployment Guide:** [docs/DEPLOYMENT.md](./DEPLOYMENT.md)
- **Project README:** [README.md](../README.md)
- **Contract Source:** [contracts/CAPToken.sol](../contracts/CAPToken.sol)

---

## ⚡ Pro Tips

1. **Always test on localhost first** before deploying to testnet
2. **Deployment addresses are tracked automatically** in `deployments.json` - no manual copying needed!
3. **Leave `CAP_TOKEN_ADDRESS` empty** in `.env` - auto-detection works better
4. **Use environment-specific addresses** - don't reuse test addresses for production
5. **Enable gas reporting** during testing: `npm run test:gas`
6. **Verify contracts immediately** after deployment while fresh
7. **Use hardware wallets** for mainnet deployments
8. **Monitor gas prices** before mainnet deployment: https://etherscan.io/gastracker
9. **Run comprehensive localhost tests**: `npm run test:localhost` (after `npm run node` and `npm run deploy:localhost`)

---

## 🔗 Quick Links

| Network | Explorer                                             | Faucet                                          |
| ------- | ---------------------------------------------------- | ----------------------------------------------- |
| Sepolia | [sepolia.etherscan.io](https://sepolia.etherscan.io) | [sepoliafaucet.com](https://sepoliafaucet.com/) |
| Mainnet | [etherscan.io](https://etherscan.io)                 | N/A                                             |

---

Need more help? Check the [full deployment guide](./DEPLOYMENT.md) or open an issue on GitHub.
