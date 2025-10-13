# 🌐 Public Testnet Deployment Guide

Deploy the Cyberia (CAP) governance token to public testnets for community testing and demonstration.

## 🎯 Quick Deploy Options

### **Option 1: Sepolia (Ethereum Testnet) - Recommended**
- **Best for**: Full Ethereum ecosystem compatibility
- **Gas**: Real ETH simulation
- **Explorers**: Etherscan support
- **Faucets**: Multiple options available

### **Option 2: Holesky (New Ethereum Testnet)**
- **Best for**: Latest Ethereum features
- **Gas**: Cheapest ETH testnet
- **Status**: Ethereum Foundation official testnet

### **Option 3: Arbitrum Sepolia**
- **Best for**: L2 testing, lower gas costs
- **Gas**: Very cheap
- **Features**: Arbitrum ecosystem

## 🚀 Deployment Steps

### **1. Get Testnet Funds**

**Sepolia ETH:**
- [Alchemy Faucet](https://sepoliafaucet.com/)
- [Infura Faucet](https://www.infura.io/faucet/sepolia)
- [Chain.link Faucet](https://faucets.chain.link/)

**Holesky ETH:**
- [Holesky Faucet](https://faucet.holesky.ethpandaops.io/)
- [Stakely Faucet](https://stakely.io/en/faucet/ethereum-holesky-testnet-eth)

**Arbitrum Sepolia ETH:**
- [Arbitrum Bridge](https://bridge.arbitrum.io/) (bridge Sepolia ETH)
- [Alchemy Arbitrum Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)

### **2. Setup Environment**

```bash
# Copy and configure environment
cp .env.example .env

# Edit .env with your details:
# - Choose your preferred testnet RPC URL
# - Add your wallet private key
# - Add API keys for contract verification
# - Set OWNER_ADDRESS (your wallet or DAO address)
# - Set FEE_RECIPIENT (treasury or 0x000...000 for burn)
```

### **3. Deploy to Your Chosen Network**

```bash
# Sepolia (recommended)
npm run deploy

# Holesky (newest Ethereum testnet)
npm run deploy:holesky

# Arbitrum Sepolia (L2, cheap gas)
npm run deploy:arbitrum

```

### **4. Verify Contract**

```bash
# Sepolia
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>

# Holesky
npx hardhat verify --network holesky <DEPLOYED_ADDRESS>

# Arbitrum Sepolia
npx hardhat verify --network arbitrum-sepolia <DEPLOYED_ADDRESS>
```

### **5. Configure (Optional)**

```bash
# Add deployed address to .env
CAP_TOKEN_ADDRESS=<DEPLOYED_ADDRESS>
POOL_ADDRESS=<MOCK_POOL_ADDRESS>

# Configure pools and settings
npm run configure              # Sepolia
npm run configure:holesky      # Holesky
npm run configure:arbitrum     # Arbitrum Sepolia
```

## 🔗 Public Access URLs

### **Contract Explorers**

**Sepolia:**
- Etherscan: `https://sepolia.etherscan.io/address/<CONTRACT_ADDRESS>`
- OpenZeppelin Defender: Auto-detection

**Holesky:**
- Etherscan: `https://holesky.etherscan.io/address/<CONTRACT_ADDRESS>`

**Arbitrum Sepolia:**
- Arbiscan: `https://sepolia.arbiscan.io/address/<CONTRACT_ADDRESS>`

### **Interact via Web3 Wallets**

Users can interact directly through:
- **MetaMask**: Add contract and interact
- **WalletConnect**: Any compatible wallet
- **Frame**: Desktop wallet integration
- **Rabby**: Multi-chain wallet

## 🧪 Public Testing Features

### **Basic Token Functions**
- ✅ **Transfer**: Standard ERC20 transfers with tax
- ✅ **Approve**: Standard ERC20 approvals
- ✅ **Burn**: Token burning functionality
- ✅ **Governance**: Delegate voting power

### **Tax System Testing**
- ✅ **Transfer Tax**: 1% on user-to-user transfers
- ✅ **Sell Tax**: 2% total (1% transfer + 1% sell) to AMM pools
- ✅ **Buy Tax**: 0% from AMM pools to users
- ✅ **Burn Mode**: Set fee recipient to 0x000...000

### **Administrative Functions** (Owner Only)
- ✅ **Tax Configuration**: Update rates (max 5% each)
- ✅ **Pool Management**: Add/remove AMM pools
- ✅ **Fee Recipient**: Change treasury or enable burn mode
- ✅ **Pause/Unpause**: Emergency controls
- ✅ **Upgrades**: UUPS proxy upgrades

### **Governance Features**
- ✅ **Delegation**: Self-delegate for voting power
- ✅ **Voting Power**: Check getVotes() after delegation
- ✅ **Permit**: Gasless approvals via signatures

## 📊 Expected Deployment Results

### **Contract Details**
- **Name**: Cyberia
- **Symbol**: CAP
- **Total Supply**: 1,000,000,000 CAP (1B tokens)
- **Decimals**: 18
- **Initial Owner**: Your specified address
- **Proxy Pattern**: UUPS (Upgradeable)

### **Initial Configuration**
- **Transfer Tax**: 1% (100 basis points)
- **Sell Tax**: 1% (100 basis points)
- **Buy Tax**: 0% (0 basis points)
- **Max Tax Cap**: 5% (500 basis points)
- **Fee Recipient**: Your specified treasury
- **Paused**: false

### **Gas Costs (Approximate)**
- **Sepolia**: ~0.015 ETH deployment
- **Holesky**: ~0.005 ETH deployment
- **Arbitrum Sepolia**: ~0.002 ETH deployment

## 🔧 Post-Deployment Testing

### **1. Basic Functionality Test**
```javascript
// In browser console or hardhat console
const contract = new ethers.Contract(address, abi, signer);

// Check basic info
await contract.name(); // "Cyberia"
await contract.symbol(); // "CAP"
await contract.totalSupply(); // 1e27

// Test transfer with tax
await contract.transfer(userAddress, ethers.parseEther("100"));
```

### **2. Governance Test**
```javascript
// Delegate to self for voting power
await contract.delegate(yourAddress);

// Check voting power
await contract.getVotes(yourAddress);
```

### **3. Tax System Test**
```javascript
// Add a mock pool
await contract.addPool(poolAddress);

// Test sell tax (transfer to pool)
await contract.transfer(poolAddress, ethers.parseEther("10"));
```

## 📱 Mobile-Friendly Testing

### **MetaMask Mobile**
1. Add testnet network to MetaMask mobile
2. Import contract address
3. Test transfers and interactions

### **WalletConnect Integration**
1. Use any WalletConnect-compatible mobile wallet
2. Connect to dApps for testing
3. Test governance delegation

## 🎭 Demo Scenarios

### **DAO Governance Simulation**
1. Deploy with DAO address as owner
2. Demonstrate tax policy changes
3. Show pool management
4. Test emergency pause functionality

### **Treasury Management Demo**
1. Set treasury as fee recipient
2. Demonstrate fee collection
3. Switch to burn mode (zero address)
4. Show supply reduction

### **Multi-Chain Demonstration**
1. Deploy on multiple testnets
2. Compare gas costs and speeds
3. Demonstrate cross-chain compatibility

## ⚠️ Important Notes

- **Testnet Funds**: Ensure sufficient testnet ETH/MATIC for gas
- **Private Keys**: Never use mainnet private keys for testing
- **API Limits**: Free RPC providers have rate limits
- **Verification**: May take 5-10 minutes on some networks
- **Upgrades**: Test upgrade functionality carefully

## 🔗 Resources

- **Faucets**: Get testnet funds for deployment
- **RPC Providers**: Alchemy, Infura, QuickNode
- **Explorers**: Etherscan, Arbiscan, PolygonScan
- **Wallets**: MetaMask, WalletConnect, Frame

The deployed contracts will be fully functional and publicly accessible for testing all governance token features!