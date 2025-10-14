# CAP Token Governance Guide

This guide explains how to manage the CAP token through DAO governance, including the tax change timelock mechanism.

## Overview

The CAP token is designed to be owned and controlled by the Cyberia DAO. All administrative functions are restricted to the contract owner (which should be the DAO after initial deployment).

## Tax Management with Timelock

To prevent front-running and ensure transparency, tax changes require a 24-hour timelock period.

### Proposing Tax Changes

**Step 1: Propose New Tax Rates**

```solidity
// Example: Propose 2% transfer, 3% sell, 0.5% buy
capToken.proposeTaxChange(200, 300, 50);
```

**Events Emitted:**

```solidity
TaxChangeProposed(200, 300, 50, effectiveTimestamp)
```

The `effectiveTimestamp` will be `block.timestamp + 24 hours`.

**Constraints:**

- Individual tax max: 500 bp (5%)
- Combined transfer + sell max: 800 bp (8%)
- Only owner (DAO) can propose

### Applying Tax Changes

**Step 2: Wait 24 Hours**

The DAO community has 24 hours to review the proposed changes. During this time:

- The proposal is publicly visible on-chain
- Current taxes remain in effect
- Community can discuss and prepare

**Step 3: Apply the Changes**

After 24 hours have passed:

```solidity
capToken.applyTaxChange();
```

**Events Emitted:**

```solidity
TaxesUpdated(200, 300, 50)
```

The new taxes take effect immediately.

### Emergency Tax Changes

For critical situations (e.g., initial setup, security incident), the DAO can bypass the timelock:

```solidity
// ⚠️ Use with extreme caution
capToken.setTaxesImmediate(100, 100, 0);
```

**When to use:**

- Initial contract setup
- Security emergency requiring immediate action
- Never use for routine tax adjustments

## Example Governance Workflows

### Scenario 1: Routine Tax Adjustment

**Goal:** Increase sell tax to discourage price dumping

```javascript
// Day 1: Propose change
await dao.execute(
  capToken.address,
  "proposeTaxChange(uint256,uint256,uint256)",
  [100, 250, 0] // 1% transfer, 2.5% sell, 0% buy
);

// Community discusses for 24 hours

// Day 2: Apply change
await dao.execute(capToken.address, "applyTaxChange()", []);
```

### Scenario 2: Adding New AMM Pool

**Goal:** Add Uniswap V3 pool for ETH/CAP trading

```javascript
await dao.execute(capToken.address, "addPool(address)", [UNISWAP_V3_POOL_ADDRESS]);

// No timelock needed - takes effect immediately
```

**Events Emitted:**

```solidity
PoolAdded(UNISWAP_V3_POOL_ADDRESS)
```

### Scenario 3: Enabling Burn Mode

**Goal:** Burn tax fees instead of sending to treasury

```javascript
await dao.execute(capToken.address, "setFeeRecipient(address)", ["0x0000000000000000000000000000000000000000"]);

// All future tax fees will be burned
```

**Events Emitted:**

```solidity
FeeRecipientUpdated(oldRecipient, 0x0000000000000000000000000000000000)
```

### Scenario 4: Minting for Cross-Chain Bridge

**Goal:** Mint tokens for LayerZero OFT bridge

```javascript
// Must be within MAX_SUPPLY cap (10B tokens)
await dao.execute(capToken.address, "mint(address,uint256)", [OFT_ADAPTER_ADDRESS, ethers.parseEther("1000000")]);
```

**Events Emitted:**

```solidity
TokensMinted(OFT_ADAPTER_ADDRESS, 1000000000000000000000000)
Transfer(0x0, OFT_ADAPTER_ADDRESS, 1000000000000000000000000)
```

## Tax Behavior Reference

Understanding how taxes apply in different scenarios:

### User-to-User Transfer

```
User A --[1000 CAP]--> User B
Tax: 1% (10 CAP to treasury)
User B receives: 990 CAP
```

### Sell to Pool

```
User --[1000 CAP]--> AMM Pool
Tax: 2% (10 CAP transfer + 10 CAP sell = 20 CAP total)
Pool receives: 980 CAP
```

### Buy from Pool

```
AMM Pool --[1000 CAP]--> User
Tax: 0% (default)
User receives: 1000 CAP
```

### Pool-to-Pool Transfer

```
Pool A --[1000 CAP]--> Pool B
Tax: 0% (tax-exempt for liquidity operations)
Pool B receives: 1000 CAP
```

### Burn Mode Transfer

```
User A --[1000 CAP]--> User B (with burn mode enabled)
Tax: 1% (10 CAP burned, reducing total supply)
User B receives: 990 CAP
Total supply: -10 CAP
```

## Aragon OSx Integration

### Setting Up Token Voting Plugin

```javascript
const tokenVotingSettings = {
  votingMode: 0, // Standard voting
  supportThreshold: 500000, // 50%
  minParticipation: 150000, // 15%
  minDuration: 86400, // 24 hours
  minProposerVotingPower: ethers.parseEther("10000"), // 10k CAP
};

await tokenVotingPlugin.initialize(dao.address, tokenVotingSettings, capToken.address);
```

### Creating a Tax Change Proposal

```javascript
// 1. Encode the proposal action
const proposalAction = {
  to: capToken.address,
  value: 0,
  data: capToken.interface.encodeFunctionData("proposeTaxChange", [200, 300, 50]),
};

// 2. Create proposal
const proposalId = await tokenVotingPlugin.createProposal(
  "0x1234", // metadata URI
  [proposalAction],
  0, // no allowFailureMap
  0, // auto-start
  0, // auto-end
  VoteOption.None
);

// 3. Community votes for 24 hours

// 4. Execute proposal (if passed)
await tokenVotingPlugin.execute(proposalId);

// 5. Wait 24 hours for tax timelock

// 6. Create second proposal to apply taxes
const applyAction = {
  to: capToken.address,
  value: 0,
  data: capToken.interface.encodeFunctionData("applyTaxChange", []),
};

const applyProposalId = await tokenVotingPlugin.createProposal("0x5678", [applyAction], 0, 0, 0, VoteOption.None);

// 7. Execute apply proposal
await tokenVotingPlugin.execute(applyProposalId);
```

## Monitoring and Security

### Events to Monitor

```javascript
// Monitor tax change proposals
capToken.on("TaxChangeProposed", (transfer, sell, buy, effectiveTime) => {
  console.log(`Tax change proposed: ${transfer}bp transfer, ${sell}bp sell, ${buy}bp buy`);
  console.log(`Effective at: ${new Date(effectiveTime * 1000)}`);

  // Alert community
  sendDiscordAlert(`⚠️ New tax proposal. Review before ${new Date(effectiveTime * 1000)}`);
});

// Monitor actual tax changes
capToken.on("TaxesUpdated", (transfer, sell, buy) => {
  console.log(`Taxes updated: ${transfer}bp, ${sell}bp, ${buy}bp`);
});

// Monitor large mints
capToken.on("TokensMinted", (to, amount) => {
  if (amount > ethers.parseEther("1000000")) {
    console.warn(`⚠️ Large mint detected: ${ethers.formatEther(amount)} CAP to ${to}`);
  }
});

// Monitor fee recipient changes
capToken.on("FeeRecipientUpdated", (oldRecipient, newRecipient) => {
  const mode = newRecipient === ethers.ZeroAddress ? "BURN MODE" : "Treasury";
  console.log(`Fee recipient changed: ${oldRecipient} → ${newRecipient} (${mode})`);
});
```

### Security Checklist for Proposals

Before creating a tax change proposal:

- [ ] Verify new rates are within limits (≤5% individual, ≤8% combined)
- [ ] Calculate impact on holders and traders
- [ ] Discuss with community in governance forum
- [ ] Consider market conditions and liquidity
- [ ] Prepare announcement for 24-hour review period
- [ ] Set up monitoring for the effective timestamp

Before applying a tax change:

- [ ] Confirm 24 hours have elapsed
- [ ] Verify community had adequate time to review
- [ ] Check for any last-minute concerns
- [ ] Prepare announcement for actual change

## Common Issues and Solutions

### Issue: "TIMELOCK_NOT_EXPIRED" Error

**Problem:** Trying to apply tax change before 24 hours
**Solution:** Wait until `taxChangeTimestamp` has passed

```javascript
const timestamp = await capToken.taxChangeTimestamp();
const now = Math.floor(Date.now() / 1000);
const waitTime = timestamp - now;

console.log(`Wait ${waitTime} more seconds (${waitTime / 3600} hours)`);
```

### Issue: "NO_PENDING_CHANGE" Error

**Problem:** No tax change has been proposed
**Solution:** First call `proposeTaxChange()`, then wait 24h, then call `applyTaxChange()`

### Issue: Pool Not Recognized

**Problem:** Transfers to pool still applying regular transfer tax
**Solution:** Pool must be added via `addPool()` function

```javascript
await dao.execute(capToken.address, "addPool(address)", [POOL_ADDRESS]);
```

### Issue: "EXCEEDS_MAX_SUPPLY" on Mint

**Problem:** Attempting to mint beyond 10B cap
**Solution:** Total supply + mint amount must be ≤ 10,000,000,000 CAP

```javascript
const currentSupply = await capToken.totalSupply();
const maxSupply = await capToken.MAX_SUPPLY();
const available = maxSupply - currentSupply;

console.log(`Available to mint: ${ethers.formatEther(available)} CAP`);
```

## Best Practices

1. **Tax Changes:**
   - Use timelock for all routine tax adjustments
   - Only use `setTaxesImmediate()` in true emergencies
   - Announce proposals publicly before submitting
   - Allow community discussion during 24h period

2. **Pool Management:**
   - Add all official AMM pools immediately after creation
   - Remove deprecated pools to prevent confusion
   - Verify pool addresses before adding

3. **Fee Management:**
   - Treasury address should be a Gnosis Safe multisig
   - Only enable burn mode after community consensus
   - Monitor treasury balance regularly

4. **Minting:**
   - Only mint for approved use cases (e.g., bridging)
   - Document reason for each mint in proposal
   - Never exceed MAX_SUPPLY

5. **Upgrades:**
   - Test thoroughly on testnet first
   - Get security audit for implementation changes
   - Use timelock on DAO level for upgrade proposals
   - Verify storage layout compatibility

## Resources

- [Aragon OSx Documentation](https://devs.aragon.org/)
- [OpenZeppelin Upgrades Guide](https://docs.openzeppelin.com/upgrades-plugins)
- [CAP Token Contract](../contracts/CAPToken.sol)
- [Test Examples](../test/integration/DAO-Integration.test.ts)
