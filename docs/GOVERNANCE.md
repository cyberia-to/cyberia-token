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

## Emergency Procedures

### When to Use Emergency Functions

The CAP token includes emergency functions that bypass the normal 24-hour timelock. These should ONLY be used in the following situations:

#### Critical Situations Requiring Immediate Action

1. **Security Exploit Detected**
   - An active attack is draining liquidity
   - A vulnerability is being exploited in the tax mechanism
   - Contract behavior is causing unintended token loss

2. **Market Manipulation**
   - Coordinated attack to exploit tax arbitrage
   - Flash loan attack abusing pool detection
   - Extreme tax burden causing cascading failures

3. **Initial Setup/Migration**
   - Setting initial tax rates during deployment
   - Migrating from old contract to new implementation
   - Correcting deployment configuration errors

### Emergency Function: setTaxesImmediate()

```solidity
// ⚠️ BYPASSES 24-HOUR TIMELOCK - USE WITH EXTREME CAUTION
capToken.setTaxesImmediate(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp)
```

**When to use:**

- Immediate response to active exploit
- Critical market protection
- Initial deployment setup

**When NOT to use:**

- Routine tax adjustments (use `proposeTaxChange()` instead)
- Community-requested changes (allow 24h review period)
- Gradual policy changes

**Example Emergency Response:**

```javascript
// SCENARIO: Exploit detected where attackers are using pool transfers to avoid taxes
// IMMEDIATE ACTION: Set all taxes to minimal values temporarily

// Step 1: Emergency DAO call (requires multi-sig or high quorum)
await daoExecute(
  capToken.address,
  "setTaxesImmediate(uint256,uint256,uint256)",
  [0, 0, 0] // Temporarily disable all taxes to stop exploit
);

// Step 2: Remove exploited pool
await daoExecute(capToken.address, "removePool(address)", [EXPLOITED_POOL_ADDRESS]);

// Step 3: Communicate to community immediately
announceEmergency("Tax system temporarily disabled due to active exploit. Team investigating.");

// Step 4: After exploit is fixed, restore normal taxes using standard timelock
await daoExecute(
  capToken.address,
  "proposeTaxChange(uint256,uint256,uint256)",
  [100, 100, 0] // Restore normal taxes with 24h notice
);
```

### Emergency Function: cancelTaxChange()

```solidity
// Cancel a pending tax change during the 24-hour timelock period
capToken.cancelTaxChange()
```

**When to use:**

- Error discovered in proposed tax rates
- Community identifies issue during review period
- Market conditions change significantly
- Incorrect proposal parameters

**Example Cancellation:**

```javascript
// SCENARIO: Proposed tax change has error - combined rate would exceed 8% cap
// (This should be caught by contract validation, but shown for illustration)

// Day 1: Tax change proposed
await dao.execute(
  capToken.address,
  "proposeTaxChange(uint256,uint256,uint256)",
  [400, 500, 0] // 4% transfer + 5% sell = 9% combined (exceeds cap)
);
// Note: This would actually revert with "COMBINED_SELL_TAX_TOO_HIGH"

// Community spots issue during review period
// Cancel before it takes effect
await dao.execute(capToken.address, "cancelTaxChange()", []);

// Re-propose with correct values
await dao.execute(
  capToken.address,
  "proposeTaxChange(uint256,uint256,uint256)",
  [300, 400, 0] // 3% transfer + 4% sell = 7% combined (within cap)
);
```

### Emergency Response Checklist

#### Immediate Response (0-1 hour)

- [ ] **Confirm the emergency** - Verify the issue is real and active
- [ ] **Assess impact** - Determine severity and affected users
- [ ] **Alert core team** - Notify all multi-sig signers immediately
- [ ] **Pause if possible** - Consider if emergency action is warranted
- [ ] **Document everything** - Record timeline, actions, and rationale

#### Short-term Response (1-24 hours)

- [ ] **Execute emergency action** - Use `setTaxesImmediate()` if necessary
- [ ] **Communicate publicly** - Announce on Discord, Twitter, governance forum
- [ ] **Investigate root cause** - Determine how the issue occurred
- [ ] **Prepare fix** - Develop proper solution (may require upgrade)
- [ ] **Monitor contract** - Watch for further issues or exploitation

#### Long-term Response (24+ hours)

- [ ] **Restore normal operation** - Use standard timelock for any further changes
- [ ] **Post-mortem analysis** - Document what happened and lessons learned
- [ ] **Security improvements** - Update processes to prevent recurrence
- [ ] **Community update** - Full transparency report to DAO
- [ ] **Consider audit** - If new code deployed, get security review

### Emergency Communication Template

```markdown
🚨 EMERGENCY ALERT: CAP Token

**Status:** [Active Incident / Resolved / Monitoring]
**Severity:** [Critical / High / Medium]
**Time Detected:** [UTC timestamp]

**Issue Description:**
[Brief explanation of what happened]

**Immediate Actions Taken:**

- [Action 1 with timestamp]
- [Action 2 with timestamp]

**User Impact:**

- Affected users: [number or "all holders"]
- Financial impact: [estimated]
- Current status: [trading paused/modified/normal]

**Next Steps:**

1. [Planned action 1]
2. [Planned action 2]

**Timeline:**

- [Time] - Issue detected
- [Time] - Emergency DAO call initiated
- [Time] - Emergency function executed
- [Time] - [Current status]

**Resources:**

- Transaction: [Etherscan link]
- Discussion: [Governance forum link]
- Updates: [Discord channel]

We will provide updates every [X] hours until resolved.
```

### Governance Escalation Paths

Different severity levels require different approval processes:

#### Level 1: Routine (Standard Timelock)

- **Use:** Normal tax adjustments, pool additions, fee recipient updates
- **Process:** `proposeTaxChange()` → 24h wait → `applyTaxChange()`
- **Approval:** Standard DAO proposal (50% support, 15% participation)
- **Timeline:** Minimum 48 hours (24h proposal + 24h timelock)

#### Level 2: Urgent (Fast-Track)

- **Use:** Time-sensitive but non-critical changes
- **Process:** Expedited DAO proposal with higher quorum
- **Approval:** 60% support, 25% participation, shorter voting period
- **Timeline:** 12-24 hours

#### Level 3: Emergency (Immediate)

- **Use:** Active exploits, critical security issues
- **Process:** Multi-sig emergency action or ultra-high quorum snapshot
- **Approval:** 3/5 multi-sig OR 75% support with 40% participation
- **Timeline:** 0-2 hours
- **Follow-up:** Ratification vote within 7 days

### Post-Emergency Audit Requirements

After using any emergency function:

1. **Transparency Report** (within 48 hours)
   - Detailed timeline of events
   - Rationale for emergency action
   - List of all affected transactions
   - Financial impact assessment

2. **Community Ratification** (within 7 days)
   - Formal DAO vote to ratify emergency actions
   - Discussion period for concerns
   - Plan to prevent similar issues

3. **Security Review** (if code changed)
   - External audit of any new implementation
   - Peer review by other developers
   - Testnet deployment and testing

4. **Process Improvement** (within 30 days)
   - Update emergency procedures based on lessons learned
   - Enhance monitoring and alerts
   - Improve response time capabilities

## Best Practices

1. **Tax Changes:**
   - Use timelock for all routine tax adjustments
   - Only use `setTaxesImmediate()` in true emergencies
   - Announce proposals publicly before submitting
   - Allow community discussion during 24h period
   - Use `cancelTaxChange()` if errors discovered during review

2. **Pool Management:**
   - Add all official AMM pools immediately after creation
   - Remove deprecated pools to prevent confusion
   - Verify pool addresses before adding
   - Monitor pool behavior for anomalies

3. **Fee Management:**
   - Treasury address should be a Gnosis Safe multisig
   - Only enable burn mode after community consensus
   - Monitor treasury balance regularly
   - Ensure multi-sig signers are available 24/7 for emergencies

4. **Minting:**
   - Only mint for approved use cases (e.g., bridging)
   - Document reason for each mint in proposal
   - Never exceed MAX_SUPPLY
   - Verify recipient address before minting

5. **Upgrades:**
   - Test thoroughly on testnet first
   - Get security audit for implementation changes
   - Use timelock on DAO level for upgrade proposals
   - Verify storage layout compatibility
   - Have rollback plan prepared

6. **Emergency Preparedness:**
   - Maintain 24/7 monitoring of contract events
   - Keep multi-sig signers on alert
   - Pre-approve emergency action templates
   - Run quarterly emergency response drills
   - Document all decision-makers' contact info

## Resources

- [Aragon OSx Documentation](https://devs.aragon.org/)
- [OpenZeppelin Upgrades Guide](https://docs.openzeppelin.com/upgrades-plugins)
- [CAP Token Contract](../contracts/CAPToken.sol)
- [Test Examples](../test/integration/DAO-Integration.test.ts)
