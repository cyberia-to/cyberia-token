/**
 * Transfer CAP token governance to Aragon DAO
 *
 * This script transfers control of the CAP token from the deployer address
 * to the Aragon DAO, enabling governance-controlled token administration.
 *
 * After this transfer:
 * - All token admin functions require DAO proposals
 * - Tax changes require DAO vote + 24h timelock
 * - Pool management requires DAO approval
 * - Upgrades require DAO approval
 * - Minting requires DAO approval + 7d timelock
 *
 * Usage:
 *   npm run dao:transfer-governance
 *   or: npx hardhat run --network sepolia scripts/dao/transfer-governance.ts
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        Transfer CAP Token Governance to DAO               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📋 Configuration:");
  console.log("  Network:", network.name);
  console.log("  Chain ID:", network.chainId);
  console.log("  Deployer:", deployer.address);
  console.log("  CAP Token:", process.env.CAP_TOKEN_ADDRESS);
  console.log("  DAO Address:", process.env.ARAGON_DAO_ADDRESS);
  console.log("");

  // Validate environment
  if (!process.env.CAP_TOKEN_ADDRESS) {
    throw new Error("❌ CAP_TOKEN_ADDRESS not set in .env");
  }

  if (!process.env.ARAGON_DAO_ADDRESS) {
    throw new Error("❌ ARAGON_DAO_ADDRESS not set in .env. Run: npm run dao:create");
  }

  const capTokenAddress = process.env.CAP_TOKEN_ADDRESS;
  const daoAddress = process.env.ARAGON_DAO_ADDRESS;

  // Get CAP token contract
  console.log("🔍 Loading CAP token contract...");
  const CAPToken = await ethers.getContractFactory("CAPToken");
  const capToken = CAPToken.attach(capTokenAddress);

  // Check current governance
  console.log("🔍 Checking current governance...");
  const currentGovernance = await capToken.governance();
  console.log("  Current Governance:", currentGovernance);

  if (currentGovernance.toLowerCase() === daoAddress.toLowerCase()) {
    console.log("✅ Governance already transferred to DAO!");
    console.log("   Nothing to do.\n");
    return;
  }

  if (currentGovernance.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `❌ Current governance (${currentGovernance}) is not the deployer (${deployer.address}). Cannot transfer.`
    );
  }

  console.log("✅ Deployer has governance control\n");

  // Confirm transfer
  console.log("⚠️  WARNING: This action is IRREVERSIBLE!");
  console.log("   After transfer, only the DAO can control the token.\n");
  console.log("   The DAO will be able to:");
  console.log("   • Change tax rates (via proposals + 24h timelock)");
  console.log("   • Add/remove AMM pools");
  console.log("   • Update fee recipient");
  console.log("   • Upgrade token implementation");
  console.log("   • Mint new tokens (via proposals + 7d timelock)\n");

  // Perform transfer
  console.log("🔐 Transferring governance to DAO...");
  console.log(`   From: ${currentGovernance}`);
  console.log(`   To:   ${daoAddress}\n`);

  try {
    const tx = await capToken.setGovernance(daoAddress);
    console.log("📝 Transaction submitted:", tx.hash);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await tx.wait();

    console.log("✅ Transaction confirmed!");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());
    console.log("");

    // Verify transfer
    console.log("🔍 Verifying governance transfer...");
    const newGovernance = await capToken.governance();
    console.log("   New Governance:", newGovernance);

    if (newGovernance.toLowerCase() === daoAddress.toLowerCase()) {
      console.log("✅ Governance successfully transferred to DAO!\n");

      console.log("╔════════════════════════════════════════════════════════════╗");
      console.log("║                  🎉 TRANSFER COMPLETE!                     ║");
      console.log("╚════════════════════════════════════════════════════════════╝\n");

      console.log("📍 Governance Address: " + daoAddress);
      console.log("🔗 View DAO: https://app.aragon.org/#/daos/sepolia/" + daoAddress);
      console.log("");

      console.log("╔════════════════════════════════════════════════════════════╗");
      console.log("║                      📝 NEXT STEPS                         ║");
      console.log("╚════════════════════════════════════════════════════════════╝\n");
      console.log("1. ✅ Governance Transferred!");
      console.log("   All token admin functions now require DAO proposals\n");
      console.log("2. 🗳️  Delegate Your Tokens (to vote on proposals):");
      console.log("   npm run dao:delegate\n");
      console.log("3. 🧪 Test Creating a Proposal:");
      console.log("   npm run dao:test\n");
      console.log("4. 💰 Configure Treasury (optional):");
      console.log("   See docs/safe-setup-guide.md\n");
      console.log("5. 📊 Try Changing Tax Rates:");
      console.log("   - Create proposal to change taxes");
      console.log("   - Vote on proposal");
      console.log("   - Wait 24h timelock");
      console.log("   - Apply tax changes\n");
    } else {
      throw new Error("Governance verification failed");
    }
  } catch (error) {
    console.error("\n❌ Error transferring governance:");
    console.error("  Message:", error instanceof Error ? error.message : String(error));

    if (error && typeof error === "object" && "reason" in error) {
      console.error("  Reason:", error.reason);
    }

    console.error("\n💡 Troubleshooting:");
    console.error("  - Ensure you're the current governance address");
    console.error("  - Check ARAGON_DAO_ADDRESS is correct");
    console.error("  - Verify you have Sepolia ETH for gas");
    console.error("  - Make sure DAO was created successfully\n");

    throw error;
  }
}

// Execute
main()
  .then(() => {
    console.log("✅ Script completed successfully\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error.message);
    process.exit(1);
  });
