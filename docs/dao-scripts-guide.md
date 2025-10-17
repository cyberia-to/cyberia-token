# DAO Scripts Guide

Complete reference for interacting with your Aragon DAO and managing CAP token governance.

## Overview

This guide covers all DAO-related scripts for the Cyberia (CAP) token project. These scripts use **Aragon OSx contracts directly** (no deprecated SDK) for maximum reliability and transparency.

## Prerequisites

Before using DAO scripts, ensure you have:

1. **Created Aragon DAO** via [https://app.aragon.org](https://app.aragon.org)
2. **Installed Token Voting Plugin** with CAP token
3. **Environment Variables** configured in `.env`:
   ```bash
   CAP_TOKEN_ADDRESS=0xA6B680A88c16056de7194CF775D04A45D0692C11
   ARAGON_DAO_ADDRESS=0x...        # From Aragon UI
   CAP_GOVERNANCE_PLUGIN_ADDRESS=0x...  # From Aragon UI → Settings → Plugins
   ```

## Script Organization

```
scripts/dao/
├── transfer-governance.ts      # Transfer token control to DAO
├── delegate-tokens.ts          # Activate voting power
└── osx/
    └── get-dao-info.ts        # Query DAO configuration
```

**Note**: Proposal creation, voting, and execution are done via the Aragon App UI at https://app.aragon.org for the best user experience and reliability.

---

## Setup Scripts

### 1. Transfer Governance

**Purpose**: Transfer CAP token control from deployer to Aragon DAO

**Command**:

```bash
npm run dao:transfer-governance
```

**What it does**:

- Transfers ownership of CAP token to DAO address
- Makes all admin functions require DAO proposals
- **IRREVERSIBLE** - Cannot undo without DAO vote

**After transfer, the DAO controls**:

- Tax rate changes (with 24h timelock)
- Pool management (add/remove AMM pairs)
- Fee recipient updates
- Token upgrades (UUPS)
- Minting new tokens (with 7d timelock)

**Example output**:

```
✅ Governance successfully transferred to DAO!

📍 Governance Address: 0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0
🔗 View DAO: https://app.aragon.org/#/daos/sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0
```

**Requirements**:

- Must be current governance address (deployer initially)
- DAO must exist and be valid
- Sepolia ETH for gas

---

### 2. Delegate Tokens

**Purpose**: Activate your voting power for DAO participation

**Command**:

```bash
npm run dao:delegate
```

**What it does**:

- Delegates your CAP tokens to yourself
- Activates voting power (required for ERC20Votes)
- Enables you to vote on proposals
- Enables you to create proposals (if you have ≥10,000 CAP)

**Why is this needed?**

ERC20Votes tokens (like CAP) require explicit delegation to activate voting power. Until you delegate, your token balance doesn't grant voting rights.

**Example output**:

```
✅ Your voting power is now active!

📊 Your Voting Stats:
   Balance: 1000000 CAP
   Voting Power: 1000000 votes
   Min to Create Proposal: 10,000 CAP

✅ You have enough power to create proposals!
```

**Requirements**:

- Must hold CAP tokens
- Sepolia ETH for gas
- Only need to do this once (unless you transfer all tokens)

---

## Query Scripts

### 3. Get DAO Info

**Purpose**: Query DAO configuration and current status

**Command**:

```bash
npm run dao:info
```

**What it shows**:

- **CAP Token Info**: Name, symbol, supply, governance, taxes
- **DAO Info**: Address, URI, governance transfer status
- **Plugin Info**: Voting settings, proposal count, thresholds
- **Your Stats**: Balance, voting power, delegation status

**Example output**:

```
═══════════════════════════════════════════════════════════════
                    CAP TOKEN INFO
═══════════════════════════════════════════════════════════════

📊 Token Details:
  Name: Cyberia
  Symbol: CAP
  Total Supply: 1000000000 CAP
  Governance: 0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0

💰 Tax Configuration:
  Transfer Tax: 1 %
  Sell Tax: 1 %
  Buy Tax: 0 %
  Fee Recipient: 0x37Bb361F12D10F31a963033e1D0B3bb3026D6654

🗳️  Your Voting Power:
  Balance: 1000000 CAP
  Voting Power: 1000000 votes
  Delegated to: 0xYourAddress
  Delegated to self: ✅ YES

═══════════════════════════════════════════════════════════════
                      DAO INFO
═══════════════════════════════════════════════════════════════

🏛️  DAO Details:
  Address: 0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0
  Governance transferred: ✅ YES

═══════════════════════════════════════════════════════════════
                 TOKEN VOTING PLUGIN INFO
═══════════════════════════════════════════════════════════════

⚙️  Plugin Settings:
  Voting Token: 0xA6B680A88c16056de7194CF775D04A45D0692C11
  Token Match: ✅ YES
  Min Proposer Power: 10000 CAP
  Support Threshold: 50 %
  Min Participation: 15 %
  Min Duration: 86400 seconds ( 24 hours)
  Total Proposals: 0

📊 Voting Power Stats:
  Total Voting Power: 1000000000 votes
  Your Voting Power: 1000000 votes
  Your Share: 0.1000 %

✅ Can Create Proposals: YES
```

**Requirements**:

- Environment variables set
- No gas required (read-only)

---

## Managing Proposals via Aragon UI

All proposal operations (create, vote, execute) should be done through the Aragon App UI for the best experience.

### Creating Proposals

1. Visit https://app.aragon.org
2. Navigate to your DAO
3. Click **"New Proposal"**
4. Select action type:
   - **Add Pool**: Use "Contract Interaction" → CAP token → `addPool(address)`
   - **Change Taxes**: Use "Contract Interaction" → CAP token → `proposeTaxChange(uint256,uint256,uint256)`
   - **Update Fee Recipient**: Use "Contract Interaction" → CAP token → `setFeeRecipient(address)`
   - **Mint Tokens**: Use "Contract Interaction" → CAP token → `proposeMint(address,uint256)`
5. Fill in parameters
6. Add title and description
7. Click **"Publish"**
8. Vote automatically recorded (if you have voting power)

### Voting on Proposals

1. Visit https://app.aragon.org
2. Navigate to your DAO → **Proposals**
3. Click on the proposal
4. Review details and actions
5. Click **"Vote"** (Yes/No/Abstain)
6. Confirm transaction

### Executing Proposals

1. After voting period ends and thresholds met
2. Visit the proposal page
3. Click **"Execute"**
4. Confirm transaction
5. Actions are applied to CAP token

---

## Archived: Script-Based Proposal Management

The following sections describe script-based proposal management which has been deprecated in favor of the Aragon UI.

<details>
<summary>Click to view archived script documentation</summary>

### 4. Create Proposal (DEPRECATED - Use Aragon UI)

**Purpose**: Create a new DAO proposal to execute token admin functions

**Command**:

```bash
npm run dao:create-proposal
```

**What it does**:

- Creates a proposal with encoded action(s)
- Automatically votes YES (if you created it)
- Attempts early execution if thresholds met
- Returns proposal ID and link to Aragon UI

**Example proposal**: Add test AMM pool

The script includes an example that proposes adding a pool address:

```typescript
const testPoolAddress = "0x2222222222222222222222222222222222222222";
const addPoolCalldata = capToken.interface.encodeFunctionData("addPool", [testPoolAddress]);
```

**Example output**:

```
✅ Proposal created!

🆔 Proposal ID: 0

🔗 View Proposal:
   https://app.aragon.org/dao/ethereum-sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0/proposals/0

🔍 Can Execute: NO ⏳

⏳ Proposal needs to meet execution criteria:
   - Voting period must end
   - Minimum participation threshold
   - Support threshold (>50%)

💡 To execute later, run:
   PROPOSAL_ID=0 npm run dao:execute
```

**Requirements**:

- Must have ≥10,000 CAP voting power (min proposer power)
- Must have delegated tokens to self
- Sepolia ETH for gas

**Customizing proposals**:

To create different proposals, modify the `actions` array in the script:

```typescript
// Example: Change tax rates
const proposeTaxCalldata = capToken.interface.encodeFunctionData("proposeTaxChange", [
  150, // 1.5% transfer tax
  150, // 1.5% sell tax
  50, // 0.5% buy tax
]);

const actions = [
  {
    to: capTokenAddress,
    value: 0,
    data: proposeTaxCalldata,
  },
];
```

**Available actions**:

- `addPool(address)` - Add AMM pool
- `removePool(address)` - Remove AMM pool
- `proposeTaxChange(uint256,uint256,uint256)` - Propose tax change
- `setFeeRecipient(address)` - Update fee recipient
- `proposeMint(address,uint256)` - Propose minting tokens
- `upgradeToAndCall(address,bytes)` - Upgrade token implementation

---

### 5. Vote on Proposal

**Purpose**: Vote YES, NO, or ABSTAIN on an active proposal

**Command**:

```bash
PROPOSAL_ID=0 VOTE=yes npm run dao:vote
```

**Vote options**:

- `yes` - Vote in favor
- `no` - Vote against
- `abstain` - Neutral vote (counts for participation)

**What it does**:

- Checks if you can vote (have voting power, haven't voted yet)
- Submits your vote on-chain
- Attempts early execution if thresholds met
- Shows updated vote tally

**Example output**:

```
🗳️  Voting "YES" on proposal...

✅ Vote submitted!

📊 Updated Proposal Tally:
  Yes: 1000000 CAP
  No: 0 CAP
  Abstain: 0 CAP
  Executed: NO ⏳

⏳ Proposal not yet executable. Requirements:
  Support Threshold: >50%
  Min Participation: >15%
  Min Duration: 86400 seconds

🔗 View Proposal:
  https://app.aragon.org/dao/ethereum-sepolia/0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0/proposals/0
```

**Requirements**:

- Must have voting power at proposal creation time
- Must not have already voted
- Voting period must be active
- Sepolia ETH for gas

**Why can't I vote?**

- You didn't have voting power when proposal was created
- You already voted on this proposal
- Voting period has ended
- Proposal has been executed

---

### 6. Execute Proposal

**Purpose**: Execute a proposal that has passed voting requirements

**Command**:

```bash
PROPOSAL_ID=0 npm run dao:execute
```

**What it does**:

- Checks if proposal can be executed
- Executes all proposal actions on-chain
- Actions are applied to the CAP token contract

**Execution requirements**:

1. **Voting period ended** (min duration passed)
2. **Support threshold met** (>50% YES votes)
3. **Min participation met** (>15% of voting power participated)
4. **Not already executed**

**Example output**:

```
⚡ Executing proposal...

✅ Proposal executed!

🔗 View Transaction:
  https://sepolia.etherscan.io/tx/0x...

╔════════════════════════════════════════════════════════════╗
║              🎉 PROPOSAL EXECUTED!                         ║
╚════════════════════════════════════════════════════════════╝

✅ The proposal actions have been applied to the CAP token!

💡 Verify the changes:
  - If it was a pool addition, check isPool()
  - If it was a tax change, check the new tax rates
  - If it was a fee recipient change, check feeRecipient()
```

**Requirements**:

- Proposal must have passed
- Voting period must have ended
- Sepolia ETH for gas
- Anyone can execute (not just proposer/voters)

**Cannot execute yet?**

If you get "NO ❌", the script shows why:

```
⚠️  Proposal cannot be executed yet. Possible reasons:
  - Voting period has not ended
  - Not enough support (needs >50%)
  - Minimum participation not met (needs >15%)
  - Already executed
```

---

## Complete Governance Workflow

### Example: Change Tax Rates

**Step 1: Create Proposal** (modify script to propose tax change)

```bash
# Edit scripts/dao/osx/create-proposal.ts with tax change action
npm run dao:create-proposal
# Output: Proposal ID: 0
```

**Step 2: Vote on Proposal**

```bash
PROPOSAL_ID=0 VOTE=yes npm run dao:vote
```

**Step 3: Wait for Voting Period**

```bash
# Min duration: 24 hours (86400 seconds)
# Check status: npm run dao:info
```

**Step 4: Execute Proposal**

```bash
PROPOSAL_ID=0 npm run dao:execute
# Tax change is now pending (24h timelock)
```

**Step 5: Apply Tax Change** (after 24h)

```bash
# Create another proposal to call applyTaxChange()
# Or call directly if you're the governance address
```

### Example: Add AMM Pool

**Step 1: Create Proposal**

```bash
# Script includes pool addition example by default
npm run dao:create-proposal
# Output: Proposal ID: 1
```

**Step 2: Vote**

```bash
PROPOSAL_ID=1 VOTE=yes npm run dao:vote
```

**Step 3: Wait & Execute**

```bash
# Wait 24h, then execute
PROPOSAL_ID=1 npm run dao:execute
# Pool is now added immediately
```

### Example: Update Fee Recipient (Set Safe Treasury)

**Step 1: Create Proposal** (modify script)

```typescript
const setFeeRecipientCalldata = capToken.interface.encodeFunctionData("setFeeRecipient", ["0xYourSafeAddress"]);
```

**Step 2-4: Vote, wait, execute** (same as above)

---

## Environment Variables

Required in `.env`:

```bash
# Network RPC
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Deployer/signer private key
PRIVATE_KEY=0x...

# CAP Token (from deployment)
CAP_TOKEN_ADDRESS=0xA6B680A88c16056de7194CF775D04A45D0692C11

# Aragon DAO (from app.aragon.org)
ARAGON_DAO_ADDRESS=0x9Ccc4Bc3A159F2f812B3790EcaabDa3051C70Ae0

# Token Voting Plugin (from Aragon UI → Settings → Plugins)
CAP_GOVERNANCE_PLUGIN_ADDRESS=0xf1a054C12659D65892a2b0c4c5136A93b8a5F115
```

**Finding plugin address**:

1. Go to https://app.aragon.org
2. Open your DAO
3. Navigate to: **Settings** → **Plugins**
4. Find **Token Voting** plugin
5. Copy the contract address

---

## Script Technical Details

### Direct Contract Calls (No SDK)

All scripts use **direct ethers.js contract calls** to Aragon OSx contracts:

```typescript
// TokenVoting plugin ABI
const tokenVotingABI = [
  "function createProposal(...) external returns (uint256)",
  "function vote(uint256 _proposalId, uint8 _voteOption, bool _tryEarlyExecution) external",
  "function execute(uint256 _proposalId) external",
  // ... other functions
];

const tokenVoting = new ethers.Contract(pluginAddress, tokenVotingABI, signer);
```

**Benefits**:

- No deprecated SDK dependencies
- Full transparency (see exact contract calls)
- More reliable and maintainable
- Works with any Aragon OSx DAO

### Vote Options

Vote options are encoded as numbers:

- `1` = Abstain
- `2` = Yes
- `3` = No

Scripts accept human-readable input (`yes`, `no`, `abstain`) and convert to numbers.

### Early Execution

Scripts pass `tryEarlyExecution: true` to voting functions. If a proposal meets thresholds before the voting period ends, it will execute immediately.

**Early execution criteria**:

- Support threshold met (>50%)
- Minimum participation met (>15%)
- Impossible to change outcome even with remaining votes

---

## Troubleshooting

### "Insufficient voting power"

**Cause**: You don't have ≥10,000 CAP to create proposals

**Solution**:

- Acquire more CAP tokens
- Or reduce `minProposerVotingPower` via DAO proposal (requires existing proposal)

### "You haven't delegated your tokens"

**Cause**: Voting power not activated

**Solution**:

```bash
npm run dao:delegate
```

### "You cannot vote on this proposal"

**Causes**:

1. Already voted → Check Aragon UI
2. No voting power at creation → Delegate tokens before next proposal
3. Voting period ended → Proposal can be executed if passed
4. Already executed → Check Aragon UI

### "Proposal cannot be executed yet"

**Causes**:

1. Voting period not ended → Wait 24 hours
2. Not enough YES votes → Need >50% support
3. Not enough participation → Need >15% of voting power
4. Already executed → Check Aragon UI

### "NOT_GOVERNANCE" error

**Cause**: Trying to call admin function directly (not via DAO)

**Solution**: All admin functions require DAO proposals after governance transfer

### Plugin address not found

**Solution**:

1. Open Aragon UI: https://app.aragon.org
2. Navigate to your DAO
3. Settings → Plugins
4. Copy Token Voting plugin address
5. Add to `.env` as `CAP_GOVERNANCE_PLUGIN_ADDRESS`

---

## Aragon UI vs Scripts

**When to use Aragon UI** (https://app.aragon.org):

- View all proposals and their status
- Browse voting history
- Check DAO configuration
- Visual proposal creation (easier for non-technical users)
- Monitor vote tallies in real-time

**When to use scripts**:

- Automated workflows (CI/CD)
- Programmatic proposal creation
- Batch operations
- Integration with other tools
- Technical control and transparency

**Best practice**: Use both! Create proposals via scripts, monitor via UI.

---

## Security Best Practices

### Before transferring governance:

1. ✅ **Test DAO creation** on Sepolia first
2. ✅ **Verify token voting plugin** is correctly configured
3. ✅ **Delegate tokens** to yourself
4. ✅ **Create test proposal** and execute it successfully
5. ✅ **Ensure backup plan** (emergency multisig?)

### After transferring governance:

1. ✅ **Test proposal creation** immediately
2. ✅ **Document all admin functions** requiring DAO votes
3. ✅ **Set up monitoring** for proposals
4. ✅ **Educate token holders** about voting
5. ✅ **Consider Gnosis Safe** with Zodiac for treasury

### Proposal creation:

1. ✅ **Test actions** on Sepolia first
2. ✅ **Document proposal intent** clearly (use IPFS metadata)
3. ✅ **Double-check addresses** and parameters
4. ✅ **Consider timelocks** (taxes: 24h, minting: 7d)
5. ✅ **Announce proposals** to community

---

</details>

## Advanced Usage (For Script Development)

### Multiple Actions in One Proposal

```typescript
const actions = [
  {
    to: capTokenAddress,
    value: 0,
    data: capToken.interface.encodeFunctionData("addPool", [pool1]),
  },
  {
    to: capTokenAddress,
    value: 0,
    data: capToken.interface.encodeFunctionData("addPool", [pool2]),
  },
  {
    to: capTokenAddress,
    value: 0,
    data: capToken.interface.encodeFunctionData("proposeTaxChange", [100, 100, 0]),
  },
];
```

All actions execute atomically if proposal passes.

### IPFS Metadata

For rich proposal descriptions:

```typescript
// Upload description to IPFS, get CID
const ipfsCID = "QmXyz...";
const metadata = ethers.toUtf8Bytes(`ipfs://${ipfsCID}`);
```

Metadata format (JSON on IPFS):

```json
{
  "title": "Add Uniswap V3 Pool",
  "description": "This proposal adds the CAP/ETH Uniswap V3 pool to the token's pool registry...",
  "resources": [
    {
      "name": "Pool Contract",
      "url": "https://sepolia.etherscan.io/address/0x..."
    }
  ]
}
```

### Querying Past Proposals

```typescript
const proposalCount = await tokenVoting.proposalCount();
console.log("Total proposals:", proposalCount);

for (let i = 0; i < proposalCount; i++) {
  const proposal = await tokenVoting.getProposal(i);
  console.log(`Proposal ${i}:`, proposal);
}
```

---

## Summary: NPM Commands

| Command                           | Purpose               | Requirements      |
| --------------------------------- | --------------------- | ----------------- |
| `npm run dao:transfer-governance` | Transfer token to DAO | Deployer key, gas |
| `npm run dao:delegate`            | Activate voting power | CAP tokens, gas   |
| `npm run dao:info`                | Query DAO status      | None (read-only)  |

**Proposal Management**: Use Aragon UI at https://app.aragon.org for creating, voting on, and executing proposals.

---

## Additional Resources

- **Aragon OSx Docs**: https://devs.aragon.org/
- **Aragon App**: https://app.aragon.org
- **CAP Token Contract**: https://sepolia.etherscan.io/address/0xA6B680A88c16056de7194CF775D04A45D0692C11
- **Token Voting Plugin Docs**: https://devs.aragon.org/docs/osx/how-to-guides/plugin-development/token-voting-plugin
- **Zodiac Safe Setup**: See [docs/zodiac-roles-config.json](zodiac-roles-config.json)

---

**Questions or issues?** Open an issue at https://github.com/cyberia-to/cyberia-token/issues
