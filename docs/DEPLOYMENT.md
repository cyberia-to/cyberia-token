# Cyberia (CAP) Token - Deployment Guide

This comprehensive guide covers deploying and configuring the Cyberia (CAP) token across all supported environments: localhost, Sepolia testnet, and Ethereum mainnet.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Localhost Deployment](#localhost-deployment)
- [Sepolia Testnet Deployment](#sepolia-testnet-deployment)
- [Mainnet Deployment](#mainnet-deployment)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Contract Verification](#contract-verification)
- [Deployment Tracking](#deployment-tracking)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- Node.js v20+ (recommended: use the version specified in `.nvmrc`)
- npm v10+
- Git

### Required Accounts

- **For Testnet/Mainnet:**
  - Ethereum wallet with private key
  - RPC provider account (Alchemy, Infura, or similar)
  - Etherscan API key (for contract verification)
  - Test ETH (for Sepolia) or real ETH (for mainnet)

### Install Dependencies

```bash
git clone <repository-url>
cd cyberia-token
npm install
```

---

## Environment Setup

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure for Your Target Environment

#### For Localhost Development

```env
# No RPC URLs needed
LOCALHOST_OWNER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
LOCALHOST_FEE_RECIPIENT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

#### For Sepolia Testnet

```env
# RPC Configuration
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Wallet
PRIVATE_KEY=your_private_key_here

# Verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# Deployment Config
SEPOLIA_OWNER_ADDRESS=0xYourDAOorTestAddress
SEPOLIA_FEE_RECIPIENT=0xYourTreasuryOrTestAddress
```

#### For Mainnet (Production)

```env
# RPC Configuration
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Wallet (use hardware wallet or secure key management!)
PRIVATE_KEY=your_production_private_key

# Verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# Deployment Config (CRITICAL - Double check these!)
MAINNET_OWNER_ADDRESS=0xYourDAOGovernanceAddress
MAINNET_FEE_RECIPIENT=0xYourTreasurySafeAddress
```

### 3. Security Best Practices

- **Never commit `.env` to version control** (already in `.gitignore`)
- **Use environment-specific private keys** - don't reuse production keys for testing
- **For mainnet, use hardware wallets** (Ledger, Trezor) when possible
- **Verify all addresses** before deployment - incorrect addresses cannot be changed easily
- **Use a dedicated deployment wallet** with only the ETH needed for deployment

---

## Localhost Deployment

Perfect for development, testing, and debugging before deploying to public networks.

### Option 1: Using Hardhat's Built-in Network (Fastest)

This runs an in-process blockchain that's created and destroyed for each test run.

```bash
# Compile contracts
npm run build

# Run tests (automatically uses in-process network)
npm test

# Run all tests
npm run test:all

# Run with gas reporting
npm run test:gas
```

### Option 2: Using a Persistent Local Node

This runs a local Ethereum node that persists between commands.

#### Step 1: Start Local Node

In one terminal:

```bash
npm run node
```

This starts a local Hardhat node at `http://127.0.0.1:8545` with pre-funded test accounts.

#### Step 2: Deploy to Local Node

In another terminal:

```bash
npm run deploy:localhost
```

#### Step 3: Configure (Optional)

```bash
# Set the deployed contract address in .env
CAP_TOKEN_ADDRESS=0x... # Address from deployment output

# Add a test pool
POOL_ADDRESS=0xSomeTestPoolAddress

# Run configuration
npm run configure:localhost
```

### Localhost Test Accounts

Hardhat provides 20 pre-funded accounts. The first few are:

| Account       | Address                                      | Private Key                                                          | Initial Balance |
| ------------- | -------------------------------------------- | -------------------------------------------------------------------- | --------------- |
| #0 (Deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` | 10,000 ETH      |
| #1            | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` | 10,000 ETH      |
| #2            | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` | 10,000 ETH      |

---

## Sepolia Testnet Deployment

### Prerequisites

1. **Get Sepolia Test ETH:**
   - [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
   - [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
   - Minimum: 0.05 ETH recommended

2. **Configure RPC URL:**
   - Sign up for [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/)
   - Create a Sepolia app and get your API key

3. **Configure .env:**
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   PRIVATE_KEY=your_private_key_here
   ETHERSCAN_API_KEY=your_etherscan_api_key
   SEPOLIA_OWNER_ADDRESS=0xYourAddress
   SEPOLIA_FEE_RECIPIENT=0xYourTreasuryAddress
   ```

### Deployment Steps

#### Step 1: Compile Contracts

```bash
npm run build
```

#### Step 2: Deploy to Sepolia

```bash
npm run deploy:sepolia
```

This will:

- Display deployment configuration
- Deploy the UUPS proxy and implementation
- Mint 1B CAP tokens to the owner
- Save deployment details to `deployments.json`
- Show next steps

#### Step 3: Verify Contract on Etherscan

```bash
npm run verify:sepolia <PROXY_ADDRESS>
```

Or manually:

```bash
npx hardhat verify --network sepolia <PROXY_ADDRESS>
```

#### Step 4: Configure Pools (Optional)

```bash
# Update .env with deployed address and pool
CAP_TOKEN_ADDRESS=<DEPLOYED_PROXY_ADDRESS>
POOL_ADDRESS=<UNISWAP_PAIR_ADDRESS>

# Run configuration
npm run configure:sepolia
```

### Post-Deployment Verification

Check your deployment on Sepolia Etherscan:

```
https://sepolia.etherscan.io/address/<YOUR_PROXY_ADDRESS>
```

Verify:

- ✅ Contract is verified (green checkmark)
- ✅ Owner is correct
- ✅ Total supply is 1,000,000,000 CAP
- ✅ Fee recipient is configured

**Note:** The deployment address is automatically saved to `deployments.json`, so you don't need to manually track it!

---

## Mainnet Deployment

### ⚠️ Critical Pre-Deployment Checklist

Before deploying to mainnet, verify:

- [ ] All tests pass: `npm run test:all`
- [ ] Contracts compiled without warnings: `npm run build`
- [ ] Security audit completed (highly recommended)
- [ ] Owner address is your DAO governance contract
- [ ] Fee recipient is your Treasury Safe address
- [ ] Private key is from a secure hardware wallet
- [ ] Sufficient ETH for deployment (~0.01-0.05 ETH + buffer)
- [ ] All addresses triple-checked (use checksummed addresses)
- [ ] Team notified of deployment
- [ ] Emergency procedures in place

### Prerequisites

1. **ETH for Gas:**
   - Estimated cost: 0.01-0.05 ETH (varies with gas prices)
   - Check current gas prices: [ETH Gas Station](https://ethgasstation.info/)

2. **Production Configuration:**

   ```env
   MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
   PRIVATE_KEY=your_secure_production_key
   ETHERSCAN_API_KEY=your_etherscan_api_key
   MAINNET_OWNER_ADDRESS=0xYourDAOGovernanceAddress
   MAINNET_FEE_RECIPIENT=0xYourTreasurySafeAddress
   ```

3. **Double-Check Addresses:**
   ```bash
   # Verify addresses are valid and checksummed
   node -e "const ethers = require('ethers'); \
     console.log('Owner:', ethers.getAddress('YOUR_OWNER_ADDRESS')); \
     console.log('Fee Recipient:', ethers.getAddress('YOUR_FEE_RECIPIENT'));"
   ```

### Deployment Steps

#### Step 1: Final Testing

```bash
# Run complete test suite
npm run test:all

# Check gas costs
npm run test:gas
```

#### Step 2: Deploy to Mainnet

```bash
npm run deploy:mainnet
```

**Monitor the deployment:**

- Transaction hash will be displayed
- Wait for confirmations (5 blocks for mainnet)
- Save all output for records

#### Step 3: Verify Contract on Etherscan

```bash
npm run verify:mainnet <PROXY_ADDRESS>
```

This makes your contract source code public and verifiable.

#### Step 4: Configure Production Settings

```bash
# Update .env
CAP_TOKEN_ADDRESS=<DEPLOYED_PROXY_ADDRESS>
POOL_ADDRESS=<UNISWAP_PAIR_ADDRESS>

# Configure pools
npm run configure:mainnet
```

#### Step 5: Post-Deployment Actions

1. **Verify Deployment:**

   ```
   https://etherscan.io/address/<YOUR_PROXY_ADDRESS>
   ```

2. **Save Deployment Information:**
   - Proxy address
   - Implementation address
   - Transaction hash
   - Block number
   - Deployer address

3. **Update Documentation:**
   - Update README.md with mainnet address
   - Document in team wiki/notion
   - Create deployment announcement

4. **Security Measures:**
   - Transfer deployer key to cold storage
   - Set up monitoring/alerts
   - Configure Tenderly or similar monitoring service

5. **Governance Setup:**
   - Verify owner is DAO governance
   - Test governance proposal flow
   - Document emergency procedures

---

## Post-Deployment Configuration

### 🎯 Automatic Address Detection

**Good news!** You don't need to set `CAP_TOKEN_ADDRESS` manually. The configuration script automatically detects the deployed address for each network from `deployments.json`.

### Adding AMM Pools

When you create Uniswap or other DEX pairs:

```bash
# Set in .env (contract address auto-detected!)
POOL_ADDRESS=<AMM_PAIR_ADDRESS>

# Run configuration - automatically uses the right address
npm run configure:localhost  # For localhost
npm run configure:sepolia    # For sepolia
npm run configure:mainnet    # For mainnet
```

**How it works:**

1. Script checks for `CAP_TOKEN_ADDRESS` in `.env`
2. If not found, reads from `deployments.json` for current network
3. Uses the correct address automatically

### Updating Fee Recipient

```bash
# Set in .env (contract address auto-detected!)
NEW_FEE_RECIPIENT=<NEW_TREASURY_ADDRESS>

# Run configuration
npm run configure:<network>
```

### Manual Override (Optional)

If needed, you can override the address:

```bash
CAP_TOKEN_ADDRESS=0x123... POOL_ADDRESS=0x456... npm run configure:sepolia
```

---

## Contract Verification

### Automatic Verification

```bash
npm run verify:sepolia <PROXY_ADDRESS>
npm run verify:mainnet <PROXY_ADDRESS>
```

### Manual Verification

If automatic verification fails:

```bash
npx hardhat verify --network <network> <PROXY_ADDRESS>
```

### Troubleshooting Verification

If verification fails:

1. **Check the implementation contract:**

   ```bash
   npx hardhat verify --network <network> <IMPLEMENTATION_ADDRESS>
   ```

2. **Verify with constructor arguments** (if needed):

   ```bash
   npx hardhat verify --network <network> <ADDRESS> "arg1" "arg2"
   ```

3. **Check Etherscan manually:**
   - Go to the contract on Etherscan
   - Click "Contract" tab → "Verify and Publish"
   - Select "Solidity (Single file)" or "Solidity (Standard JSON Input)"
   - Upload contract source

---

## Deployment Tracking

The project automatically tracks deployments in `deployments.json` (excluded from git).

### Deployment Record Format

```json
{
  "version": "1.0.0",
  "deployments": {
    "sepolia": {
      "network": "sepolia",
      "chainId": 11155111,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "proxyAddress": "0x...",
      "implementationAddress": "0x...",
      "deployer": "0x...",
      "owner": "0x...",
      "feeRecipient": "0x...",
      "txHash": "0x...",
      "blockNumber": 123456,
      "verified": true
    }
  }
}
```

### Viewing Deployment History

The configuration script automatically reads from `deployments.json` if `CAP_TOKEN_ADDRESS` is not set in `.env`.

---

## Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"

**Problem:** Not enough ETH in deployer wallet.

**Solution:**

```bash
# Check balance
npx hardhat run scripts/check-balance.ts --network <network>

# For testnet: Get more test ETH from faucets
# For mainnet: Add more ETH to deployer wallet
```

#### 2. "Nonce too low"

**Problem:** Transaction nonce is out of sync.

**Solution:**

```bash
# Reset Hardhat network
npm run clean
rm -rf cache artifacts

# Rebuild
npm run build
```

#### 3. "Network not found"

**Problem:** RPC URL not configured.

**Solution:**

- Check `.env` file has correct RPC URL
- Verify API key is active
- Test RPC endpoint: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' <RPC_URL>`

#### 4. "Cannot read property 'getAddress'"

**Problem:** Private key not configured correctly.

**Solution:**

- Ensure `PRIVATE_KEY` in `.env` includes the `0x` prefix
- Key should be 66 characters (0x + 64 hex characters)
- For localhost, leave blank to use default accounts

#### 5. "Contract verification failed"

**Problem:** Etherscan verification unsuccessful.

**Solution:**

- Wait 1-2 minutes after deployment
- Ensure `ETHERSCAN_API_KEY` is set
- Try verifying the implementation contract directly
- Use Etherscan's manual verification interface

#### 6. "Invalid owner address"

**Problem:** Owner address not set or invalid.

**Solution:**

```bash
# Check .env has proper configuration
# For localhost: LOCALHOST_OWNER_ADDRESS
# For sepolia: SEPOLIA_OWNER_ADDRESS
# For mainnet: MAINNET_OWNER_ADDRESS

# Verify address format (checksummed):
node -e "console.log(require('ethers').getAddress('YOUR_ADDRESS'))"
```

### Getting Help

1. **Check the logs:** Deployment scripts provide detailed error messages
2. **Review test results:** `npm test` can reveal issues before deployment
3. **Check gas prices:** High network congestion can cause failures
4. **Verify RPC provider:** Ensure your Alchemy/Infura account is active
5. **Review Hardhat configuration:** Check `hardhat.config.ts` for network settings

### Debug Mode

For more detailed output:

```bash
# Run with Hardhat verbose logging
npx hardhat --verbose run --network <network> scripts/deploy.ts
```

---

## Environment Comparison

| Feature          | Localhost           | Sepolia             | Mainnet           |
| ---------------- | ------------------- | ------------------- | ----------------- |
| **Cost**         | Free                | Free (test ETH)     | Real ETH required |
| **Speed**        | Instant             | ~12 seconds/block   | ~12 seconds/block |
| **Persistence**  | Temporary           | Permanent           | Permanent         |
| **Verification** | Not available       | Available           | Available         |
| **Purpose**      | Development/Testing | Integration Testing | Production        |
| **Reset**        | Easy                | Cannot reset        | Cannot reset      |
| **Risk**         | None                | None                | High (real value) |

---

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/getting-started/)
- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Etherscan API](https://docs.etherscan.io/)
- [Ethereum Gas Tracker](https://etherscan.io/gastracker)

---

## Support

For issues or questions:

1. Check this guide thoroughly
2. Review the main [README.md](../README.md)
3. Check existing GitHub issues
4. Create a new issue with detailed information

---

**Remember:** Always test on localhost first, then Sepolia, then mainnet. Never skip testing phases.
