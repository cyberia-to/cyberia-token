# Uniswap Pool Setup Guide for CAP Token

This guide walks you through creating a liquidity pool for CAP token on Uniswap V4 (Sepolia testnet).

## ✅ Pool Already Created!

**Good news**: A CAP/WETH pool has already been created on Uniswap V4 Sepolia:

- **Pool Manager**: `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`
- **Creation TX**: [0x35bc25cd4426bf...](https://sepolia.etherscan.io/tx/0x35bc25cd4426bf4959ec96adc6fa95cfcea528527e00f183fdcf7c6467170888)
- **DAO Proposal TX**: [0x065fb9c34cf70e...](https://sepolia.etherscan.io/tx/0x065fb9c34cf70e5a896f0e1a2036819230286696870a32858822c8e9061cdb4c)
- **Pair**: CAP/WETH
- **Fee Tier**: 0.3%
- **Initial Price**: 100,000 CAP = 1 ETH
- **Block**: 9414967

**Status**: Pool registration pending DAO approval. View proposal on [Aragon](https://app.aragon.org/#/daos/sepolia/0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33/proposals).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding Uniswap V4](#understanding-uniswap-v4)
3. [Option 1: Use Uniswap Interface (Recommended)](#option-1-use-uniswap-interface-recommended)
4. [Option 2: Create Pool Programmatically](#option-2-create-pool-programmatically)
5. [Register Pool with CAP Token](#register-pool-with-cap-token)
6. [Verify Pool Registration](#verify-pool-registration)

---

## Prerequisites

Before creating a pool, ensure you have:

- [ ] CAP token deployed on Sepolia: `0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e`
- [ ] Sepolia ETH for gas fees (get from [Sepolia faucet](https://sepoliafaucet.com/))
- [ ] CAP tokens in your wallet to provide liquidity
- [ ] Additional tokens to pair with CAP (e.g., WETH, USDC)

---

## Understanding Uniswap V4

Uniswap V4 introduces significant changes from V2/V3:

### Key Differences

| Feature             | V2/V3                         | V4                              |
| ------------------- | ----------------------------- | ------------------------------- |
| Pool Management     | Individual contracts per pool | Single **PoolManager** contract |
| Liquidity Provision | Router-based                  | **PositionManager**             |
| Customization       | Limited                       | **Hooks** for custom logic      |
| Gas Efficiency      | Higher                        | Lower (singleton design)        |

### Uniswap V4 Sepolia Addresses

```
PoolManager:     0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
PositionManager: 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4
Universal Router: 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b
StateView:       0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c
Quoter:          0x61b3f2011a92d183c7dbadbda940a7555ccf9227
Permit2:         0x000000000022D473030F116dDEE9F6B43aC78BA3
```

---

## Option 1: Use Uniswap Interface (Recommended)

### Step 1: Access Uniswap Interface

1. Go to [Uniswap App](https://app.uniswap.org/)
2. Connect your wallet (MetaMask, WalletConnect, etc.)
3. Switch network to **Sepolia Testnet**

### Step 2: Navigate to Pool Creation

1. Click on **"Pool"** in the top navigation
2. Click **"+ New Position"**
3. Select **V4** (if available, otherwise use V3)

### Step 3: Configure Pool Parameters

1. **Select tokens:**
   - Token 1: CAP (`0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e`)
   - Token 2: WETH or USDC

2. **Set fee tier:**
   - 0.01% - Stable pairs
   - 0.05% - Common pairs
   - 0.30% - Standard pairs ✅ Recommended for CAP
   - 1.00% - Exotic pairs

3. **Set price range** (for concentrated liquidity):
   - Min Price: Your lower bound
   - Max Price: Your upper bound
   - For full range: Min = 0, Max = ∞

### Step 4: Add Liquidity

1. Enter amounts for both tokens
2. Review the pool details
3. Click **"Approve CAP"** (one-time approval)
4. Wait for approval transaction to confirm
5. Click **"Add Liquidity"**
6. Confirm the transaction in your wallet
7. Wait for confirmation

### Step 5: Get Pool Address

After creation:

1. Go to **"Pool"** → **"Positions"**
2. Click on your position
3. Copy the pool address from the URL or pool details

---

## Option 2: Create Pool Programmatically

### Creating a Uniswap V4 Pool

Use the provided script to create a V4 pool programmatically:

```bash
npx hardhat run scripts/create-v4-pool.ts --network sepolia
```

This script (`scripts/create-v4-pool.ts`):

- Initializes a pool in the PoolManager contract
- Sets the initial price (default: 100,000 CAP = 1 ETH)
- Handles all V4-specific encoding (sqrtPriceX96, etc.)

### Important Note About V4

Uniswap V4 has a completely different architecture. Instead of individual pool contracts, all pools are managed by the **PoolManager** singleton contract.

### For V2/V3 Compatibility

If you need to use V2 or V3 for broader compatibility (since V4 may not be fully supported everywhere):

#### Uniswap V3 Sepolia Addresses (Alternative)

```
Factory: 0x0227628f3F023bb0B980b67D528571c95c6DaC1c
Router:  Check official docs
WETH:    0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

#### Uniswap V2 Sepolia Addresses (Community Deployment)

```
Factory: 0xF62c03E08ada871A0bEb309762E260a7a6a880E6
Router:  0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3
WETH:    0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

### Creating a V2 Pool (Simplest Option)

Since V2 is simpler and more widely supported for testing:

```bash
# Install dependencies if needed
npm install @uniswap/v2-core @uniswap/v2-periphery

# Run the pool creation script
npx hardhat run scripts/create-v2-pool.ts --network sepolia
```

**Script** (`scripts/create-v2-pool.ts`):

```typescript
import { ethers } from "hardhat";

const UNISWAP_V2_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";
const UNISWAP_V2_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const CAP_TOKEN = "0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e";

async function main() {
  const [signer] = await ethers.getSigners();

  // Amount of CAP tokens and ETH to add
  const capAmount = ethers.parseEther("10000"); // 10,000 CAP
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH

  // Connect to contracts
  const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER);

  const factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY);

  const capToken = await ethers.getContractAt("CAPToken", CAP_TOKEN);

  // Check if pair exists
  const pairAddress = await factory.getPair(CAP_TOKEN, WETH);

  if (pairAddress !== ethers.ZeroAddress) {
    console.log("✅ Pool already exists:", pairAddress);
    return pairAddress;
  }

  console.log("Creating new pool...");

  // Approve router
  console.log("Approving CAP tokens...");
  const approveTx = await capToken.approve(UNISWAP_V2_ROUTER, capAmount);
  await approveTx.wait();

  // Add liquidity (creates pair if doesn't exist)
  console.log("Adding liquidity...");
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 min

  const tx = await router.addLiquidityETH(
    CAP_TOKEN,
    capAmount,
    (capAmount * 95n) / 100n, // 5% slippage
    (ethAmount * 95n) / 100n,
    signer.address,
    deadline,
    { value: ethAmount }
  );

  await tx.wait();

  const newPairAddress = await factory.getPair(CAP_TOKEN, WETH);
  console.log("✅ Pool created:", newPairAddress);

  return newPairAddress;
}

main()
  .then((pairAddress) => {
    console.log("\n📝 Next step:");
    console.log(`Set POOL_ADDRESS=${pairAddress} in .env`);
    console.log("Then run: npm run configure:sepolia");
  })
  .catch(console.error);
```

---

## Register Pool with CAP Token

Once you have the pool address, register it with the CAP token contract:

### Step 1: Update Environment Variables

```bash
# Edit .env file
POOL_ADDRESS=0xYourPoolAddressHere
```

### Step 2: Create DAO Proposal (Required)

Since the Aragon DAO owns the CAP token, you must create a governance proposal:

```bash
npx hardhat run scripts/create-pool-proposal.ts --network sepolia
```

This script (`scripts/create-pool-proposal.ts`):

- Creates a DAO proposal to call `addPool(address)`
- Automatically votes "Yes" with your tokens
- Provides a link to view the proposal on Aragon

### Alternative: Direct Registration (If You're Owner)

If you're the contract owner, you can register directly:

```bash
npm run configure:sepolia
```

### What This Does

The registration calls `addPool(address)` on the CAP token contract (see `contracts/CAPToken.sol:157`):

```solidity
function addPool(address pool) external onlyOwner {
  require(pool != address(0), "ZERO_ADDR");
  require(!isPool[pool], "EXISTS");
  isPool[pool] = true;
  emit PoolAdded(pool);
}
```

### Important Notes

- Only the contract owner (Aragon DAO: `0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33`) can register pools
- Pool registration requires DAO governance approval
- See `docs/GOVERNANCE.md` for more on the DAO proposal process

---

## Verify Pool Registration

### Check Pool Status

```bash
npx hardhat run check-pool-status.js --network sepolia
```

### Manually Verify

```bash
npx hardhat console --network sepolia
```

```javascript
const CAP = await ethers.getContractAt("CAPToken", "0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e");
const poolAddress = "0xYourPoolAddress";
const isRegistered = await CAP.isPool(poolAddress);
console.log("Pool registered:", isRegistered);
```

---

## Tax Implications

Once a pool is registered, the CAP token tax system activates:

| Transaction Type       | Tax Applied                                  |
| ---------------------- | -------------------------------------------- |
| Buy (Pool → User)      | `buyTaxBp` (0%)                              |
| Sell (User → Pool)     | `transferTaxBp` + `sellTaxBp` (1% + 1% = 2%) |
| Transfer (User → User) | `transferTaxBp` (1%)                         |
| Pool → Pool            | No tax (0%)                                  |

Current tax rates on `contracts/CAPToken.sol:72-74`:

- Transfer Tax: 1% (100 basis points)
- Sell Tax: 1% (100 basis points)
- Buy Tax: 0% (0 basis points)

---

## Troubleshooting

### Pool Creation Fails

- **Insufficient balance**: Ensure you have enough CAP and ETH
- **Approval not granted**: Call `approve()` on CAP token first
- **Gas too low**: Increase gas limit in transaction

### Pool Registration Fails

- **Not owner**: Only Aragon DAO (`0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33`) can register pools
- **Already registered**: Pool is already in the system
- **Zero address**: Check pool address is correct

### Where to Get Help

- Check Etherscan for transaction errors
- Review CAP token events for `PoolAdded` emissions
- Consult `docs/GOVERNANCE.md` for DAO proposals
- See `test/unit/CAPToken.test.ts` for pool registration examples

---

## Next Steps

After pool creation and registration:

1. ✅ Test trading on Uniswap interface
2. ✅ Monitor tax collection in fee recipient address
3. ✅ Adjust tax rates via governance if needed (see `docs/GOVERNANCE.md`)
4. ✅ Add more liquidity as needed
5. ✅ Monitor pool analytics

---

## Useful Links

- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/)
- [Uniswap App](https://app.uniswap.org/)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [CAP Token Contract](https://sepolia.etherscan.io/address/0x7DA17a0F5A7D6AD43f1Ff4158D1818b03DE56e4e)
- [Aragon DAO](https://sepolia.etherscan.io/address/0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33)
