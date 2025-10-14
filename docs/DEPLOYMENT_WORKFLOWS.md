# Deployment Workflows Guide

This guide explains how to use the automated deployment workflows for the Cyberia (CAP) token.

## Overview

The project uses a **3-stage deployment pipeline** to ensure safe and tested deployments:

1. **Deploy to Sepolia** (Manual) → Deploys contract to testnet
2. **Test Sepolia Deployment** (Automatic) → Runs integration tests
3. **Deploy to Mainnet** (Manual + Approval) → Production deployment with release

---

## 🧪 Stage 1: Deploy to Sepolia

### Purpose

Deploy and verify the contract on Sepolia testnet for testing.

### How to Run

1. Go to **Actions** tab in GitHub
2. Select **"Deploy to Sepolia"** workflow
3. Click **"Run workflow"**
4. Fill in:
   - **Branch**: `main` or `develop`
   - **Reason**: e.g., "Initial deployment" or "Bug fix v1.2"
5. Click **"Run workflow"**

### What It Does

✅ Compiles contracts
✅ Deploys proxy + implementation to Sepolia
✅ Verifies contracts on Etherscan
✅ Saves deployment info to `deployments.json`
✅ **Automatically triggers** Stage 2 (Test Sepolia)

### Output

- Deployment summary with contract addresses
- Etherscan verification links
- Deployment artifacts uploaded

### Required Secrets

```
SEPOLIA_RPC_URL
SEPOLIA_PRIVATE_KEY
ETHERSCAN_API_KEY
SEPOLIA_OWNER_ADDRESS
SEPOLIA_FEE_RECIPIENT
```

---

## ✅ Stage 2: Test Sepolia Deployment

### Purpose

Automatically test the deployed contract and update README on success.

### How It Runs

**Automatic:** Triggered immediately after Stage 1 completes successfully.

**Manual:** You can also trigger it manually from the Actions tab to re-test.

### What It Does

1. **Integration Tests**
   - ✅ Loads deployed contract address from `deployments.json`
   - ✅ Runs integration tests against live contract
   - ✅ Validates contract configuration
   - ✅ Checks contract is accessible on Sepolia

2. **README Update** (only if tests pass)
   - ✅ Updates "Deployed Contracts" section
   - ✅ Adds proxy and implementation addresses
   - ✅ Adds deployment date and status
   - ✅ Auto-commits changes with `[skip ci]`

### Output

If tests **pass**:

- ✅ README updated with deployment info
- ✅ Changes committed automatically
- ✅ Deployment marked as tested

If tests **fail**:

- ❌ README not updated
- ❌ Deployment not marked as tested
- ⚠️ Fix issues and re-run manually

---

## 🚀 Stage 3: Deploy to Mainnet

### Purpose

Deploy to Ethereum mainnet with safety checks and create official release.

### How to Run

1. Go to **Actions** tab in GitHub
2. Select **"Deploy to Mainnet"** workflow
3. Click **"Run workflow"**
4. Fill in:
   - **Branch**: `main` (recommended)
   - **Reason**: "Official v1.0 launch" or "Production deployment"
   - **Confirm**: Type exactly `DEPLOY TO MAINNET`
5. Click **"Run workflow"**
6. **Wait for manual approval** (configured in GitHub environment settings)

### Safety Checks

Before deployment:

- ✅ Validates confirmation text matches exactly
- ✅ Checks Sepolia deployment exists
- ⚠️ Warns if Sepolia not tested
- ⚠️ Requires manual approval in GitHub

### What It Does

1. **Pre-deployment Validation**
   - Checks confirmation text
   - Verifies Sepolia deployment

2. **Deployment**
   - Compiles contracts
   - Deploys to mainnet
   - Verifies on Etherscan
   - Saves deployment info

3. **Post-deployment**
   - ✅ Creates GitHub Release with deployment details
   - ✅ Creates PR to update README (not auto-merged)
   - ✅ Uploads deployment artifacts

### Output

- GitHub Release with contract addresses
- Pull Request for README update (requires review)
- Deployment summary with next steps

### Required Secrets

```
MAINNET_RPC_URL
MAINNET_PRIVATE_KEY
ETHERSCAN_API_KEY
MAINNET_OWNER_ADDRESS
MAINNET_FEE_RECIPIENT
```

---

## 🔐 GitHub Environment Setup

### Sepolia Environment

1. Go to **Settings** → **Environments**
2. Create environment: `sepolia`
3. Add secrets:
   - `SEPOLIA_RPC_URL`
   - `SEPOLIA_PRIVATE_KEY`
   - `ETHERSCAN_API_KEY`
   - `SEPOLIA_OWNER_ADDRESS`
   - `SEPOLIA_FEE_RECIPIENT`

### Production Environment (Mainnet)

1. Create environment: `production`
2. **Enable "Required reviewers"** (recommended)
   - Add yourself or team members as reviewers
   - Requires manual approval before deployment
3. Add secrets:
   - `MAINNET_RPC_URL`
   - `MAINNET_PRIVATE_KEY`
   - `ETHERSCAN_API_KEY`
   - `MAINNET_OWNER_ADDRESS`
   - `MAINNET_FEE_RECIPIENT`

---

## 📊 Deployment Flow Diagram

```
Developer
    ↓
[Click "Deploy to Sepolia"]
    ↓
Enter Reason → Run Workflow
    ↓
┌─────────────────────────┐
│ Stage 1: Deploy Sepolia │
├─────────────────────────┤
│ • Compile               │
│ • Deploy                │
│ • Verify                │
│ • Save deployment.json  │
└──────────┬──────────────┘
           ↓ (automatic)
┌─────────────────────────┐
│ Stage 2: Test Sepolia   │
├─────────────────────────┤
│ • Run integration tests │
│ • Validate config       │
│ • Tests pass?           │
│   ↓ YES                 │
│ • Update README         │
│ • Commit changes        │
│   ✅ Done!              │
│                         │
│   ↓ NO                  │
│ • Report failure        │
│   ❌ Fix & re-run       │
└─────────────────────────┘

Later...

Developer
    ↓
[Click "Deploy to Mainnet"]
    ↓
Type "DEPLOY TO MAINNET"
    ↓
Wait for Approval ⏳
    ↓
┌─────────────────────────┐
│ Stage 3: Deploy Mainnet │
├─────────────────────────┤
│ • Validate Sepolia      │
│ • Deploy to mainnet     │
│ • Verify                │
│ • Create Release 🎉     │
│ • Create README PR      │
└─────────────────────────┘
```

---

## 🎯 Best Practices

### Before Deploying to Sepolia

- ✅ All tests passing locally
- ✅ Code reviewed and merged to main/develop
- ✅ CI pipeline passing
- ✅ .env configured correctly

### Before Deploying to Mainnet

- ✅ Sepolia deployment tested and verified
- ✅ Integration tests passed
- ✅ Security audit completed (recommended)
- ✅ Multi-sig wallet set up for ownership
- ✅ Emergency procedures documented
- ✅ Team notified of deployment

### After Mainnet Deployment

1. **Immediate** (within 1 hour):
   - Review and merge README PR
   - Verify deployment on Etherscan
   - Transfer ownership to DAO/Multi-sig
   - Configure Safe as fee recipient

2. **Short-term** (within 24 hours):
   - Add AMM pool addresses
   - Monitor first transactions
   - Announce to community
   - Update documentation

3. **Ongoing**:
   - Monitor contract activity
   - Watch for anomalies
   - Keep team informed

---

## 🆘 Troubleshooting

### Deployment Failed on Sepolia

**Error**: "Transaction reverted"

- Check RPC URL is correct
- Check private key has funds (Sepolia ETH)
- Check owner/treasury addresses are valid

**Error**: "Verification failed"

- Wait a few minutes and run `npm run verify:sepolia` manually
- Check Etherscan API key is valid

### Tests Failed After Deployment

**Error**: "Contract not found"

- Check `deployments.json` was updated
- Check RPC URL is accessible
- Wait for blockchain confirmation (30+ seconds)

**Error**: "Integration tests failed"

- Review test logs in Actions tab
- May need to re-deploy if contract is broken
- Run tests locally: `SEPOLIA_RPC_URL=... npm run test:integration`

### README Not Updated

- Check if tests passed (README only updates on success)
- Check bot has write permissions
- Manually trigger "Test Sepolia Deployment" workflow
- If still fails, update README manually

### Mainnet Deployment Blocked

**Error**: "Confirmation text does not match"

- Type exactly: `DEPLOY TO MAINNET` (case-sensitive, no extra spaces)

**Error**: "No Sepolia deployment found"

- Deploy to Sepolia first
- Ensure `deployments.json` is committed

**Error**: "Waiting for approval"

- This is normal! Check GitHub → Environments → production
- Reviewer must approve manually

---

## 📝 Manual Deployment (Fallback)

If workflows fail, you can deploy manually:

```bash
# Sepolia
npm run deploy:sepolia
npm run verify:sepolia

# Mainnet
npm run deploy:mainnet
npm run verify:mainnet
```

Then manually update README and create a GitHub Release.

---

## 🔗 Related Documentation

- [Main README](../README.md)
- [Development Guide](./DEVELOPMENT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
