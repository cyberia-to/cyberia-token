# Safe + Zodiac Setup Guide

This guide explains how to set up a Gnosis Safe with Zodiac Roles module for Cyberia DAO treasury management.

> **📋 Current Status (Sepolia):**
> ✅ CAP Token deployed: `0xA6B680A88c16056de7194CF775D04A45D0692C11`
> ⏳ Aragon DAO: Not deployed yet
> ⏳ Gnosis Safe: Not deployed yet (use this guide for setup)
> ⏳ Zodiac Roles: Not configured yet (use this guide for setup)

## Overview

The recommended architecture provides:

- **Board Operations**: Daily operations up to 50k CAP
- **Medium Operations**: Transfers 50k-200k CAP (higher threshold)
- **DAO Oversight**: Large transfers >200k CAP require governance
- **Token Administration**: All CAP token changes require DAO approval (no bypass)

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Aragon DAO    │────│  Zodiac Roles    │────│   Gnosis Safe   │
│  (Token Voting) │    │     Module       │    │   (Treasury)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌─────────▼─────────┐              │
         │              │ Board Members     │              │
         │              │ (3-of-5 Multi-sig)│              │
         │              └───────────────────┘              │
         │                                                 │
         └─────────────────────────────────────────────────┘
                              Controls
                          CAP Token Contract
```

## Prerequisites

- ✅ Deployed CAP token
- ⏳ Aragon DAO with token-voting (setup first - see [aragon-integration.md](aragon-integration.md))
- ⏳ Board member addresses
- ⏳ Treasury setup requirements

## Step 1: Deploy Gnosis Safe

### 1.1 Create Safe

Visit [Safe App](https://app.safe.global) or use Safe SDK:

```javascript
import Safe, { EthersAdapter } from "@safe-global/sdk-starter-kit";

const ethAdapter = new EthersAdapter({
  ethers,
  signerOrProvider: signer,
});

const safeAccountConfig = {
  owners: [
    "0x1234567890123456789012345678901234567890", // Board member 1
    "0x2345678901234567890123456789012345678901", // Board member 2
    "0x3456789012345678901234567890123456789012", // Board member 3
    "0x4567890123456789012345678901234567890123", // Board member 4
    "0x5678901234567890123456789012345678901234", // Board member 5
  ],
  threshold: 3, // 3-of-5 for board operations
};

const safeSdk = await Safe.create({
  ethAdapter,
  safeAccountConfig,
});

const safeAddress = await safeSdk.getAddress();
console.log("Safe deployed at:", safeAddress);
```

### 1.2 Fund Safe

Transfer initial CAP tokens and ETH for gas:

```bash
# Transfer CAP tokens to Safe
cast send $CAP_TOKEN_ADDRESS "transfer(address,uint256)" $SAFE_ADDRESS 1000000000000000000000000

# Send ETH for gas
cast send $SAFE_ADDRESS --value 1ether
```

## Step 2: Install Zodiac Roles Module

### 2.1 Enable Roles Module

Using Safe UI:

1. Go to Safe Apps → Zodiac
2. Select "Roles Modifier"
3. Click "Add Module"
4. Confirm transaction

Using Safe SDK:

```javascript
const ROLES_MOD_MASTERCOPY = "0x1ffAdc16726dd4F91fF275b4bF50651801B06a86"; // Sepolia

const enableModuleTx = await safeSdk.createEnableModuleTx(ROLES_MOD_MASTERCOPY);
const txResponse = await safeSdk.executeTransaction(enableModuleTx);
```

### 2.2 Deploy Roles Instance

```javascript
import { deployAndSetUpModule } from "@gnosis.pm/zodiac";

const rolesModuleDeployment = await deployAndSetUpModule(
  "roles",
  {
    types: ["address", "address", "address"],
    values: [
      safeAddress, // owner (Safe)
      safeAddress, // avatar (Safe)
      safeAddress, // target (Safe)
    ],
  },
  provider,
  Number(await provider.getNetwork().then((n) => n.chainId)),
  Date.now().toString()
);

console.log("Roles module deployed at:", rolesModuleDeployment.address);
```

## Step 3: Configure Roles

### 3.1 Import Configuration

1. Download `zodiac-roles-config.json` from this repository
2. Replace template variables:
   - `{{TREASURY_SAFE_ADDRESS}}` → Your Safe address
   - `{{CAP_TOKEN_ADDRESS}}` → CAP token contract address
   - `{{ARAGON_DAO_ADDRESS}}` → Aragon DAO address
3. Update board member addresses in the config

### 3.2 Validate Configuration

Before applying, validate the configuration:

```bash
# Validate with default path (docs/zodiac-roles-config.json)
npm run validate:zodiac

# Or specify custom path
ZODIAC_CONFIG_PATH=/path/to/config.json npm run validate:zodiac
```

The validator checks:

- All template variables are replaced
- All addresses are valid Ethereum addresses
- Required fields are present
- Role structure is correct

### 3.3 Apply Configuration

Using Zodiac interface:

1. Go to Safe Apps → Zodiac → Roles
2. Click "Import Configuration"
3. Upload the modified JSON file
4. Review and confirm transactions

### 3.4 Manual Role Setup (Alternative)

If importing doesn't work, set up roles manually:

```javascript
// Role 1: Board Daily Operations (up to 50k CAP)
await rolesModule.assignRoles(
  boardMemberAddress,
  [1], // role ID
  [true] // enable
);

await rolesModule.scopeTarget(
  1, // role ID
  capTokenAddress
);

await rolesModule.scopeFunction(
  1, // role ID
  capTokenAddress,
  "0xa9059cbb", // transfer(address,uint256)
  [true, true], // paramTypesCompared
  [ParameterType.Static, ParameterType.Dynamic], // paramTypes
  [Comparison.OneOf, Comparison.LessThan], // paramComparisons
  [approvedRecipients, ethers.utils.parseEther("50000")] // paramValues
);
```

## Step 4: Test Configuration

### 4.1 Test Daily Operations

Board members should be able to:

```bash
# Transfer up to 50k CAP to approved recipients
cast send $SAFE_ADDRESS "execTransactionFromModule(address,uint256,bytes,uint8)" \
  $CAP_TOKEN_ADDRESS 0 \
  $(cast calldata "transfer(address,uint256)" $APPROVED_RECIPIENT 10000000000000000000000) \
  0
```

### 4.2 Test Medium Operations

3-of-5 board members should be able to transfer 50k-200k CAP:

```javascript
// Create transaction for 100k CAP transfer
const transferTx = {
  to: capTokenAddress,
  value: 0,
  data: capTokenInterface.encodeFunctionData("transfer", [recipientAddress, ethers.utils.parseEther("100000")]),
};

// Requires 3 board member signatures
const safeTransaction = await safeSdk.createTransaction({ safeTransactionData: transferTx });
const signedTx = await safeSdk.signTransaction(safeTransaction);
const executeTxResponse = await safeSdk.executeTransaction(signedTx);
```

### 4.3 Test DAO Operations

Large transfers should require DAO proposal:

```javascript
// This should fail from board members
// Must go through Aragon DAO proposal process
const largeTx = {
  to: treasuryAddress,
  value: 0,
  data: treasuryInterface.encodeFunctionData("transfer", [
    recipientAddress,
    ethers.utils.parseEther("500000"), // >200k limit
  ]),
};

// Create DAO proposal instead
const daoProposal = {
  actions: [largeTx],
  metadata: {
    title: "Large Treasury Transfer",
    description: "Transfer 500k CAP for strategic partnership",
  },
};
```

## Step 5: Connect CAP Token

### 5.1 Set Safe as Fee Recipient

Via DAO proposal:

```javascript
const setFeeRecipientAction = {
  to: capTokenAddress,
  value: 0,
  data: capTokenInterface.encodeFunctionData("setFeeRecipient", [safeAddress]),
};

// Submit as DAO proposal
```

### 5.2 Transfer Token Governance

Transfer CAP token governance to Aragon DAO:

```javascript
const setGovernanceAction = {
  to: capTokenAddress,
  value: 0,
  data: capTokenInterface.encodeFunctionData("setGovernance", [aragonDaoAddress]),
};

// Submit as DAO proposal
```

## Operational Procedures

### Daily Operations (Board)

1. **Small transfers** (<50k CAP): Any 3 board members
2. **Approved recipients**: Pre-defined whitelist
3. **Gas management**: Board maintains ETH balance

### Medium Operations (Board)

1. **Medium transfers** (50k-200k CAP): 3-of-5 threshold
2. **Any recipient**: No whitelist restriction
3. **Documentation**: Include transfer rationale

### Large Operations (DAO)

1. **Large transfers** (>200k CAP): DAO governance required
2. **Proposal process**: Standard Aragon workflow
3. **Execution**: DAO executes via Safe

### Token Administration (DAO Only)

1. **Tax changes**: Always require DAO proposal
2. **Pool management**: Add/remove AMM pairs
3. **Upgrades**: Contract upgrades via governance
4. **Fee recipient**: Change treasury address

### Emergency Procedures

1. **Tax changes**: Require DAO proposal (24h timelock, no emergency bypass)
2. **Emergency contacts**: Predefined escalation path for urgent DAO proposals
3. **DAO governance**: DAO controls all token administration (taxes, pools, upgrades)

## Monitoring & Maintenance

### Regular Checks

- [ ] Safe balance and gas levels
- [ ] Role permissions working correctly
- [ ] DAO proposal execution capability
- [ ] Emergency procedure accessibility

### Monthly Reviews

- [ ] Update approved recipient lists
- [ ] Review spending patterns
- [ ] Adjust operational limits if needed
- [ ] Test emergency procedures

### Security Audits

- [ ] Quarterly role configuration review
- [ ] Annual security assessment
- [ ] Board member key security
- [ ] Multi-sig threshold adequacy

## Troubleshooting

### Common Issues

1. **Transaction Fails**: Check role permissions and limits
2. **Module Not Enabled**: Verify Zodiac installation
3. **DAO Can't Execute**: Confirm governance transfer
4. **Tax Changes**: All require DAO proposal + 24h timelock (no emergency override)

### Recovery Procedures

1. **Lost Board Keys**: Use DAO to update Safe owners
2. **Module Failure**: DAO can disable/replace module
3. **Safe Compromise**: DAO can change treasury address (fee recipient)
4. **Urgent Changes**: DAO proposals required (24h timelock for taxes, 7d for minting)

## Resources

- [Gnosis Safe Documentation](https://docs.safe.global/)
- [Zodiac Roles Module](https://zodiac.wiki/index.php/Category:Roles_Modifier)
- [Safe SDK](https://github.com/safe-global/safe-core-sdk)
- [Zodiac SDK](https://github.com/gnosis/zodiac-modifier-roles-v1)
