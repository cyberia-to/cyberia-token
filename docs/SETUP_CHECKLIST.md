# Setup Checklist - Ready for DAO Deployment

This document verifies that all parameters are properly configured and ready for the next setup steps.

## ✅ Current Deployment Status

### Sepolia Testnet - Deployed & Verified

| Parameter            | Value                                                                                                                 | Status      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Token Proxy**      | `0xA6B680A88c16056de7194CF775D04A45D0692C11`                                                                          | ✅ Deployed |
| **Implementation**   | `0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623`                                                                          | ✅ Verified |
| **Deployer**         | `0x9B9bD768891F014fF72864862EF14f139084992D`                                                                          | ✅ Recorded |
| **Governance**       | `0x9B9bD768891F014fF72864862EF14f139084992D` (Deployer - temporary)                                                   | ✅ Active   |
| **Fee Recipient**    | `0x37Bb361F12D10F31a963033e1D0B3bb3026D6654` (Treasury wallet)                                                        | ✅ Set      |
| **Initial Supply**   | 1,000,000,000 CAP                                                                                                     | ✅ Minted   |
| **Max Supply**       | 10,000,000,000 CAP                                                                                                    | ✅ Set      |
| **Chain ID**         | 11155111 (Sepolia)                                                                                                    | ✅ Correct  |
| **Block Number**     | 7393742                                                                                                               | ✅ Recorded |
| **Transaction Hash** | [0x2ef3e...509ab](https://sepolia.etherscan.io/tx/0x2ef3ed1760d42d0fd73bcad5498ea43deb5db0b280fe08edc7c81778975509ab) | ✅ Recorded |
| **Etherscan**        | [Verified](https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11)                           | ✅ Yes      |

## 📋 Environment Variables

### ✅ Configured & Ready

```bash
# Network Configuration
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/***         ✅ Set
ETHERSCAN_API_KEY=***                                            ✅ Set

# Deployment Addresses
SEPOLIA_OWNER_ADDRESS=0x9B9bD768891F014fF72864862EF14f139084992D  ✅ Set (Deployer)
SEPOLIA_FEE_RECIPIENT=0x37Bb361F12D10F31a963033e1D0B3bb3026D6654  ✅ Set (Treasury)

# Auto-Updated After Deployment
CAP_TOKEN_ADDRESS=0xA6B680A88c16056de7194CF775D04A45D0692C11     ✅ Updated
```

### ⏳ To Be Set After DAO Setup

```bash
# Set these after Aragon DAO deployment
ARAGON_DAO_ADDRESS=                                               ⏳ Empty (pending DAO)
CAP_GOVERNANCE_PLUGIN_ADDRESS=                                    ⏳ Empty (pending DAO)

# Set these after Gnosis Safe deployment
# (Not in .env - update in zodiac-roles-config.json)
TREASURY_SAFE_ADDRESS=                                            ⏳ Empty (pending Safe)
```

## 🔧 Configuration Files Status

### 1. `deployments.json` - ✅ Ready

```json
{
  "sepolia": {
    "network": "sepolia",
    "chainId": 11155111,
    "proxyAddress": "0xA6B680A88c16056de7194CF775D04A45D0692C11",
    "implementationAddress": "0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623",
    "deployer": "0x9B9bD768891F014fF72864862EF14f139084992D",
    "owner": "0x9B9bD768891F014fF72864862EF14f139084992D",
    "feeRecipient": "0x37Bb361F12D10F31a963033e1D0B3bb3026D6654",
    "txHash": "0x2ef3ed1760d42d0fd73bcad5498ea43deb5db0b280fe08edc7c81778975509ab",
    "blockNumber": 7393742,
    "verified": true
  }
}
```

**Status**: ✅ All deployment data recorded

### 2. `docs/zodiac-roles-config.json` - ⏳ Needs Updates

**Template Variables to Replace:**

| Variable                     | Current Value            | Needs Update To               | Status     |
| ---------------------------- | ------------------------ | ----------------------------- | ---------- |
| `{{CAP_TOKEN_ADDRESS}}`      | Template placeholder     | `0xA6B...C11`                 | ⏳ Update  |
| `{{TREASURY_SAFE_ADDRESS}}`  | Template placeholder     | Safe address after deployment | ⏳ Pending |
| `{{ARAGON_DAO_ADDRESS}}`     | Old: `0x7AFAa...eE33`    | New DAO address               | ⏳ Update  |
| Board member addresses       | Example: `0x1234...7890` | Real board member addresses   | ⏳ Update  |
| Approved recipient addresses | Example: `0x1111...1111` | Real recipient whitelist      | ⏳ Update  |

**Action Items:**

1. Replace `{{CAP_TOKEN_ADDRESS}}` with `0xA6B680A88c16056de7194CF775D04A45D0692C11`
2. Wait for Safe deployment, then replace `{{TREASURY_SAFE_ADDRESS}}`
3. After DAO deployment, update DAO address in roles (currently shows old DAO)
4. Update board member addresses with real addresses
5. Update approved recipient whitelist
6. Run `npm run validate:zodiac` before applying

### 3. Aragon Integration Guide - ✅ Ready

**File**: `docs/aragon-integration.md`

**Key Parameters Already Set:**

- ✅ Token address documented: `0xA6B680A88c16056de7194CF775D04A45D0692C11`
- ✅ Uses `process.env.CAP_TOKEN_ADDRESS` in all code examples
- ✅ Correct governance function: `setGovernance()` not `transferOwnership()`
- ✅ Status banner shows current deployment state

**Ready to Use For:**

- Deploying new Aragon DAO
- Configuring token-voting plugin
- Creating governance proposals
- Transferring governance

### 4. Safe Setup Guide - ✅ Ready

**File**: `docs/safe-setup-guide.md`

**Key Parameters:**

- ✅ References CAP token address correctly
- ✅ Links to zodiac-roles-config.json
- ✅ Status banner shows pending Safe/Zodiac
- ✅ All function selectors validated

**Ready to Use For:**

- Deploying Gnosis Safe
- Installing Zodiac Roles module
- Configuring board permissions
- Testing operational procedures

## 🎯 Next Steps Checklist

### Step 1: Deploy Aragon DAO

**Prerequisites:**

- ✅ CAP token deployed and verified
- ✅ Token implements ERC-20Votes
- ✅ Environment variables configured
- ⏳ Choose DAO parameters (support threshold, participation, etc.)

**Configuration Ready:**

```javascript
{
  token: "0xA6B680A88c16056de7194CF775D04A45D0692C11",  // ✅ Set
  supportThreshold: "500000",                           // ✅ Documented (50%)
  minParticipation: "150000",                           // ✅ Documented (15%)
  minDuration: 86400,                                   // ✅ Documented (24h)
  minProposerVotingPower: "10000000000000000000000"     // ✅ Documented (10k CAP)
}
```

**Actions:**

1. Follow `docs/aragon-integration.md`
2. Deploy DAO with token-voting plugin
3. Record DAO address in `.env`: `ARAGON_DAO_ADDRESS=...`
4. Record plugin address in `.env`: `CAP_GOVERNANCE_PLUGIN_ADDRESS=...`
5. Update `docs/zodiac-roles-config.json` with DAO address
6. Test DAO proposal creation

### Step 2: Deploy Gnosis Safe

**Prerequisites:**

- ⏳ Aragon DAO deployed (do Step 1 first)
- ⏳ Board member addresses finalized
- ⏳ Multi-sig threshold decided (recommended: 3-of-5)

**Configuration Needed:**

```javascript
{
  owners: [
    // ⏳ Replace with real board member addresses
    "0x...",  // Board member 1
    "0x...",  // Board member 2
    "0x...",  // Board member 3
    "0x...",  // Board member 4
    "0x...",  // Board member 5
  ],
  threshold: 3  // ✅ Recommended value
}
```

**Actions:**

1. Follow `docs/safe-setup-guide.md`
2. Deploy Safe with board members
3. Update `docs/zodiac-roles-config.json` with Safe address
4. Fund Safe with ETH for gas

### Step 3: Configure Zodiac Roles

**Prerequisites:**

- ⏳ Gnosis Safe deployed (do Step 2 first)
- ⏳ Aragon DAO deployed (do Step 1 first)
- ⏳ Board member addresses confirmed
- ⏳ Approved recipient whitelist prepared

**Configuration File Updates Required:**

```bash
# Before applying Zodiac config, update these in zodiac-roles-config.json:

1. Replace: {{CAP_TOKEN_ADDRESS}}
   With: 0xA6B680A88c16056de7194CF775D04A45D0692C11

2. Replace: {{TREASURY_SAFE_ADDRESS}}
   With: <SAFE_ADDRESS_FROM_STEP_2>

3. Update DAO address in roles (line 171, 207):
   From: 0x7AFAa93021b4b267DBB5DA7F2721BE23Bd77eE33 (old)
   To: <DAO_ADDRESS_FROM_STEP_1>

4. Update board member addresses (lines 15-19, 119-125)
   From: 0x1234567890123456789012345678901234567890 (example)
   To: <REAL_BOARD_ADDRESSES>

5. Update approved recipients (lines 37-39, 67-70, 97-101)
   From: 0x1111111111111111111111111111111111111111 (example)
   To: <REAL_RECIPIENT_ADDRESSES>
```

**Validation:**

```bash
# After updates, validate before applying:
npm run validate:zodiac
```

**Actions:**

1. Update zodiac-roles-config.json with all parameters
2. Validate configuration
3. Import config into Zodiac Roles module
4. Test board permissions

### Step 4: Transfer Governance to DAO

**Prerequisites:**

- ⏳ Aragon DAO deployed and tested (do Step 1 first)
- ⏳ Safe deployed and configured (do Step 2 first)
- ⏳ Zodiac roles configured (do Step 3 first)
- ⏳ Test proposals created and executed successfully

**⚠️ CRITICAL: This is irreversible! Test thoroughly first!**

**Current Governance:**

```javascript
Governance: 0x9b9bd768891f014ff72864862ef14f139084992d(Deployer);
```

**Transfer Command:**

```javascript
const capToken = await ethers.getContractAt("CAPToken", "0xA6B680A88c16056de7194CF775D04A45D0692C11");
await capToken.setGovernance(ARAGON_DAO_ADDRESS);
```

**After Transfer:**

- All admin functions require DAO proposals
- Tax changes require 24h timelock
- Minting requires 7d timelock
- Upgrades require DAO approval

**Actions:**

1. Thoroughly test DAO proposals
2. Verify board can execute via Safe
3. Transfer governance to DAO
4. Test governance proposals
5. Update fee recipient to Safe (via DAO proposal)

### Step 5: Create AMM Pool

**Prerequisites:**

- ⏳ Governance transferred to DAO (do Step 4 first)
- ⏳ Liquidity tokens ready
- ⏳ Pool parameters decided (fee tier, price range)

**Pool Configuration:**

```javascript
// Example for Uniswap V3
Pool Parameters:
  - Token A: CAP (0xA6B680A88c16056de7194CF775D04A45D0692C11)
  - Token B: WETH
  - Fee Tier: 0.3% (3000)
  - Initial Price: TBD
```

**Actions:**

1. Create pool on DEX
2. Provide initial liquidity
3. Create DAO proposal to add pool: `capToken.addPool(POOL_ADDRESS)`
4. Execute DAO proposal
5. Test buy/sell tax detection

## 📊 Parameter Summary

### Ready Now ✅

| Parameter              | Value                                        | Location                   |
| ---------------------- | -------------------------------------------- | -------------------------- |
| CAP Token Address      | `0xA6B680A88c16056de7194CF775D04A45D0692C11` | `.env`, `deployments.json` |
| Implementation Address | `0xdE7a6EbD3A91E358e7F7FEa7AD5a641c7D6Bc623` | `deployments.json`         |
| Current Governance     | `0x9B9bD768891F014fF72864862EF14f139084992D` | On-chain                   |
| Fee Recipient          | `0x37Bb361F12D10F31a963033e1D0B3bb3026D6654` | On-chain                   |
| Chain ID               | `11155111`                                   | Sepolia                    |
| Total Supply           | `1,000,000,000 CAP`                          | On-chain                   |
| Function Selectors     | All 11 validated                             | `zodiac-roles-config.json` |
| Documentation          | All guides updated                           | `docs/`                    |

### Need After DAO Deployment ⏳

| Parameter              | Where to Set          | Used For                      |
| ---------------------- | --------------------- | ----------------------------- |
| Aragon DAO Address     | `.env`, zodiac config | Governance transfer, Zodiac   |
| Governance Plugin      | `.env`                | Creating proposals            |
| Safe Address           | zodiac config         | Zodiac roles, fee recipient   |
| Board Member Addresses | zodiac config         | Safe owners, role permissions |
| Approved Recipients    | zodiac config         | Board daily ops whitelist     |
| Pool Address           | Via DAO proposal      | Tax detection                 |

## ✅ Validation Commands

```bash
# Verify deployment consistency
npm run validate:deployment:sepolia

# Check Zodiac config (after updates)
npm run validate:zodiac

# Test with Hardhat console
npm run console:sepolia
> const cap = await ethers.getContractAt("CAPToken", "0xA6B680A88c16056de7194CF775D04A45D0692C11")
> await cap.name()
> await cap.governance()
```

## 🎯 Ready Status

| Component           | Status          | Next Action                        |
| ------------------- | --------------- | ---------------------------------- |
| CAP Token           | ✅ Deployed     | None - ready to use                |
| Documentation       | ✅ Updated      | None - ready for setup             |
| Environment Vars    | ✅ Configured   | Add DAO/Safe addresses after setup |
| Deployment Record   | ✅ Saved        | None - tracking active             |
| Zodiac Config       | ⏳ Needs Update | Replace template variables         |
| Aragon DAO          | ⏳ Not Deployed | Follow aragon-integration.md       |
| Gnosis Safe         | ⏳ Not Deployed | Follow safe-setup-guide.md         |
| Governance Transfer | ⏳ Pending      | After DAO fully tested             |
| AMM Pool            | ⏳ Not Created  | After governance transfer          |

---

**Summary**: All deployment parameters are properly recorded and ready. The CAP token is deployed and verified. All configuration files and documentation are prepared for the next setup steps. Follow the Next Steps Checklist in order to complete the DAO infrastructure.
