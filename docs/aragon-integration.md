# Aragon OSx Integration Guide

This guide shows how to integrate the CAP token with Aragon OSx for DAO governance.

> **📋 Current Status (Sepolia):**
> ✅ CAP Token deployed: `0xA6B680A88c16056de7194CF775D04A45D0692C11`
> ⏳ Aragon DAO: Not deployed yet (use this guide for setup)
> ⏳ Governance transfer: Pending DAO deployment

## Overview

The CAP token implements ERC-20Votes (EIP-5805) making it fully compatible with Aragon OSx token-voting plugin and Snapshot.

## Prerequisites

- ✅ Deployed CAP token contract
- ⏳ Aragon OSx DAO setup (follow this guide)
- ⏳ Token-voting plugin installed (part of DAO setup)

## Step-by-Step Integration

### 1. Deploy Aragon DAO

```javascript
// Using Aragon OSx SDK
import { Client } from "@aragon/sdk-client";
import { TokenVotingPluginInstall } from "@aragon/sdk-client";

const client = new Client({
  network: "sepolia",
  signer: yourSigner,
});

// Create DAO with token-voting
const createDaoParams = {
  daoMetadata: {
    name: "Cyberia DAO",
    description: "Governance for the Cyberia ecosystem",
    links: [
      {
        name: "Website",
        url: "https://cyberia.example.com",
      },
    ],
  },
  plugins: [
    {
      id: "token-voting.plugin.dao.eth",
      data: {
        token: {
          address: "CAP_TOKEN_ADDRESS",
          name: "Cyberia",
          symbol: "CAP",
        },
        votingSettings: {
          votingMode: "Standard",
          supportThreshold: 0.5, // 50%
          minParticipation: 0.15, // 15%
          minDuration: 86400, // 24 hours
          minProposerVotingPower: "10000000000000000000000", // 10k CAP
        },
      },
    },
  ],
};

const daoCreation = await client.methods.createDao(createDaoParams);
```

### 2. Configure Token-Voting Plugin

```javascript
// Token-voting plugin configuration
const tokenVotingConfig = {
  // Token contract address
  token: process.env.CAP_TOKEN_ADDRESS,

  // Voting mechanics
  votingMode: "Standard", // or 'EarlyExecution'

  // Support threshold (percentage of YES votes needed)
  supportThreshold: "500000", // 50% (in ppm)

  // Minimum participation (percentage of total supply that must vote)
  minParticipation: "150000", // 15% (in ppm)

  // Minimum voting duration in seconds
  minDuration: 86400, // 24 hours

  // Minimum tokens needed to create proposals
  minProposerVotingPower: "10000000000000000000000", // 10,000 CAP tokens
};
```

### 3. Transfer Token Governance to DAO

Once the DAO is created, transfer CAP token governance control. The CAP token uses a custom `governance` address pattern:

```javascript
// Option 1: Direct transfer from deployer (outside of governance)
// Execute this from the deployer account immediately after DAO creation
const capToken = await ethers.getContractAt("CAPToken", process.env.CAP_TOKEN_ADDRESS);
await capToken.setGovernance(DAO_ADDRESS);

// Option 2: Create a governance proposal to transfer governance
// (Use this if governance is currently held by another contract/DAO)
const setGovernanceAction = {
  to: process.env.CAP_TOKEN_ADDRESS,
  value: 0,
  data: capTokenInterface.encodeFunctionData("setGovernance", [DAO_ADDRESS]),
};

// Create proposal in DAO
const proposalParams = {
  pluginAddress: tokenVotingPluginAddress,
  actions: [setGovernanceAction],
  metadata: {
    title: "Transfer CAP Token Governance to DAO",
    summary: "Transfer CAP token administrative control to the DAO",
    description:
      "This proposal transfers governance of the CAP token contract to this DAO, enabling governance-controlled administration of taxes, pools, upgrades, and minting.",
    resources: [],
  },
};

const proposal = await client.methods.createProposal(proposalParams);
```

**Important**: After transferring governance to the DAO, all administrative functions (tax changes, pool management, upgrades, minting) will require governance proposals and voting.

### 4. Example Governance Proposals

#### Update Tax Rates

```javascript
// Proposal to update tax rates (uses 24h timelock mechanism)
// Step 1: Propose the tax change
const proposeTaxChangeAction = {
  to: process.env.CAP_TOKEN_ADDRESS,
  value: 0,
  data: capTokenInterface.encodeFunctionData("proposeTaxChange", [
    50, // 0.5% transfer tax
    150, // 1.5% sell tax
    0, // 0% buy tax
  ]),
};

const taxProposal = {
  pluginAddress: tokenVotingPluginAddress,
  actions: [proposeTaxChangeAction],
  metadata: {
    title: "Propose Tax Rate Adjustment",
    summary: "Reduce transfer tax to 0.5% and increase sell tax to 1.5%",
    description:
      "This proposal initiates a 24-hour timelock for tax changes. After approval, the changes will become effective 24 hours later when applyTaxChange() is called. This timelock protects token holders from sudden tax changes.",
    resources: [
      {
        name: "Tax Impact Analysis",
        url: "https://docs.cyberia.com/tax-analysis",
      },
    ],
  },
};

// Step 2: After 24 hours, apply the tax change (requires separate proposal)
const applyTaxChangeAction = {
  to: process.env.CAP_TOKEN_ADDRESS,
  value: 0,
  data: capTokenInterface.encodeFunctionData("applyTaxChange", []),
};

// Note: Tax changes ALWAYS require 24-hour timelock for security
// There is no emergency bypass function - plan ahead for tax adjustments
// If you need to cancel a pending change, use cancelTaxChange()
const cancelTaxChangeAction = {
  to: process.env.CAP_TOKEN_ADDRESS,
  value: 0,
  data: capTokenInterface.encodeFunctionData("cancelTaxChange", []),
};
```

#### Add AMM Pool

```javascript
// Proposal to add new AMM pool
const addPoolAction = {
  to: process.env.CAP_TOKEN_ADDRESS,
  value: 0,
  data: capTokenInterface.encodeFunctionData("addPool", [
    "0x...", // New AMM pair address
  ]),
};

const poolProposal = {
  pluginAddress: tokenVotingPluginAddress,
  actions: [addPoolAction],
  metadata: {
    title: "Add New AMM Pool",
    summary: "Register CAP/USDC pair for tax detection",
    description: "Add the new Uniswap V3 CAP/USDC pool to enable proper tax classification for trades.",
    resources: [],
  },
};
```

#### Update Fee Recipient

```javascript
// Proposal to update treasury address
const updateTreasuryAction = {
  to: process.env.CAP_TOKEN_ADDRESS,
  value: 0,
  data: capTokenInterface.encodeFunctionData("setFeeRecipient", [
    "0x...", // New treasury Safe address
  ]),
};

const treasuryProposal = {
  pluginAddress: tokenVotingPluginAddress,
  actions: [updateTreasuryAction],
  metadata: {
    title: "Update Treasury Address",
    summary: "Point tax fees to new multi-sig treasury",
    description: "Update the fee recipient to the new 3-of-5 multi-sig treasury for improved security.",
    resources: [],
  },
};
```

### 5. Snapshot Integration

CAP token's ERC-20Votes compatibility enables Snapshot integration:

```javascript
// Snapshot space configuration
{
  "name": "Cyberia DAO",
  "network": "11155111", // Sepolia
  "symbol": "CAP",
  "strategies": [
    {
      "name": "erc20-votes",
      "params": {
        "address": "CAP_TOKEN_ADDRESS",
        "decimals": 18
      }
    }
  ],
  "validation": {
    "name": "basic",
    "params": {
      "minScore": 1000 // Minimum 1000 CAP to vote
    }
  },
  "filters": {
    "minScore": 0,
    "onlyMembers": false
  }
}
```

### 6. Delegation for Governance

Users can delegate their voting power:

```javascript
// Delegate voting power
const delegateTransaction = await capToken.delegate(delegateAddress);

// Self-delegate to activate voting power
const selfDelegateTransaction = await capToken.delegate(await signer.getAddress());

// Check voting power
const votingPower = await capToken.getVotes(userAddress);
const pastVotingPower = await capToken.getPastVotes(userAddress, blockNumber);
```

### 7. Monitoring & Analytics

Track DAO governance metrics:

```javascript
// Get current governance stats
const totalSupply = await capToken.totalSupply();
const delegatedSupply = await capToken.getPastTotalSupply(blockNumber);
const proposalCount = await tokenVotingPlugin.proposalCount();

// Monitor active proposals
const activeProposals = await client.methods.getProposals({
  pluginAddress: tokenVotingPluginAddress,
  status: "Active",
});

// Track voting participation
for (const proposal of activeProposals) {
  const votes = await client.methods.getProposalVotes({
    proposalId: proposal.id,
    pluginAddress: tokenVotingPluginAddress,
  });

  console.log(`Proposal ${proposal.id}:`);
  console.log(`- Yes votes: ${votes.yes}`);
  console.log(`- No votes: ${votes.no}`);
  console.log(`- Abstain votes: ${votes.abstain}`);
}
```

## Best Practices

### Proposal Guidelines

1. **Clear Titles**: Use descriptive titles that explain the action
2. **Detailed Descriptions**: Include rationale and expected impact
3. **Resources**: Link to supporting documentation
4. **Testing**: Test proposal actions on testnets first

### Voting Parameters

1. **Support Threshold**: 50% is standard for most decisions
2. **Participation**: 15% ensures sufficient engagement
3. **Duration**: 24-72 hours for normal proposals, longer for major changes
4. **Proposer Power**: Set high enough to prevent spam (10k+ CAP)

### Security Considerations

1. **Multi-step Changes**: Break large changes into multiple proposals
2. **Emergency Procedures**: Plan for urgent governance needs
3. **Delegation Security**: Educate users about delegation risks
4. **Proposal Validation**: Always validate proposal actions before voting

## Troubleshooting

### Common Issues

1. **No Voting Power**: Ensure tokens are self-delegated
2. **Proposal Fails**: Check action encoding and target contract
3. **Low Participation**: Consider adjusting parameters or incentives
4. **Gas Costs**: Optimize proposal actions to reduce execution costs

### Testing Checklist

- [ ] Token voting power calculation works
- [ ] Delegation functions properly
- [ ] Proposals can be created and executed
- [ ] Admin functions are properly protected
- [ ] Tax updates work through governance
- [ ] Emergency procedures are functional

## Resources

- [Aragon OSx Documentation](https://devs.aragon.org/osx/)
- [Token-Voting Plugin](https://devs.aragon.org/osx/how-to-guides/plugin-development/)
- [Snapshot Documentation](https://docs.snapshot.org/)
- [ERC-20Votes Standard](https://eips.ethereum.org/EIPS/eip-5805)
