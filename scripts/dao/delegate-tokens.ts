/**
 * Delegate CAP tokens to activate voting power
 *
 * For ERC20Votes tokens like CAP, voting power must be explicitly delegated.
 * This script delegates your tokens to yourself, activating your voting power.
 *
 * Usage:
 *   npm run dao:delegate
 *   or: npx hardhat run --network sepolia scripts/dao/delegate-tokens.ts
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              Delegate CAP Tokens for Voting               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📋 Configuration:");
  console.log("  Network:", network.name);
  console.log("  Address:", signer.address);
  console.log("  CAP Token:", process.env.CAP_TOKEN_ADDRESS);
  console.log("");

  if (!process.env.CAP_TOKEN_ADDRESS) {
    throw new Error("❌ CAP_TOKEN_ADDRESS not set in .env");
  }

  const capTokenAddress = process.env.CAP_TOKEN_ADDRESS;

  // Get CAP token contract
  console.log("🔍 Loading CAP token contract...");
  const CAPToken = await ethers.getContractFactory("CAPToken");
  const capToken = CAPToken.attach(capTokenAddress);

  // Check current state
  console.log("🔍 Checking current delegation...");
  const balance = await capToken.balanceOf(signer.address);
  const currentDelegate = await capToken.delegates(signer.address);
  const currentVotes = await capToken.getVotes(signer.address);

  console.log("  Balance:", ethers.formatEther(balance), "CAP");
  console.log("  Current Delegate:", currentDelegate);
  console.log("  Current Voting Power:", ethers.formatEther(currentVotes), "votes");
  console.log("");

  if (currentDelegate.toLowerCase() === signer.address.toLowerCase()) {
    console.log("✅ Already delegated to yourself!");
    console.log("   Voting power:", ethers.formatEther(currentVotes), "votes\n");
    return;
  }

  // Delegate to self
  console.log("🗳️  Delegating tokens to yourself...");
  console.log("   This will activate your voting power\n");

  try {
    const tx = await capToken.delegate(signer.address);
    console.log("📝 Transaction submitted:", tx.hash);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await tx.wait();

    console.log("✅ Transaction confirmed!");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());
    console.log("");

    // Verify delegation
    console.log("🔍 Verifying delegation...");
    const newDelegate = await capToken.delegates(signer.address);
    const newVotes = await capToken.getVotes(signer.address);

    console.log("  New Delegate:", newDelegate);
    console.log("  New Voting Power:", ethers.formatEther(newVotes), "votes");
    console.log("");

    if (newDelegate.toLowerCase() === signer.address.toLowerCase()) {
      console.log("╔════════════════════════════════════════════════════════════╗");
      console.log("║            🎉 DELEGATION SUCCESSFUL!                       ║");
      console.log("╚════════════════════════════════════════════════════════════╝\n");

      console.log("✅ Your voting power is now active!");
      console.log("   You can now vote on DAO proposals\n");

      console.log("📊 Your Voting Stats:");
      console.log("   Balance:", ethers.formatEther(balance), "CAP");
      console.log("   Voting Power:", ethers.formatEther(newVotes), "votes");
      console.log("   Min to Create Proposal: 10,000 CAP");
      console.log("");

      if (Number(ethers.formatEther(newVotes)) >= 10000) {
        console.log("✅ You have enough power to create proposals!\n");
      } else {
        console.log("⚠️  You need 10,000 CAP to create proposals");
        console.log("   Current: " + ethers.formatEther(newVotes) + " CAP\n");
      }

      console.log("╔════════════════════════════════════════════════════════════╗");
      console.log("║                      📝 NEXT STEPS                         ║");
      console.log("╚════════════════════════════════════════════════════════════╝\n");
      console.log("1. ✅ Tokens Delegated!");
      console.log("   You can now participate in governance\n");
      console.log("2. 🧪 Test DAO Functionality:");
      console.log("   npm run dao:test\n");
      console.log("3. 📝 Create Your First Proposal:");
      console.log("   Visit: https://app.aragon.org/#/daos/sepolia/" + process.env.ARAGON_DAO_ADDRESS);
      console.log("");
    } else {
      throw new Error("Delegation verification failed");
    }
  } catch (error) {
    console.error("\n❌ Error delegating tokens:");
    console.error("  Message:", error instanceof Error ? error.message : String(error));

    if (error && typeof error === "object" && "reason" in error) {
      console.error("  Reason:", error.reason);
    }

    console.error("\n💡 Troubleshooting:");
    console.error("  - Ensure you have CAP tokens");
    console.error("  - Verify you have Sepolia ETH for gas");
    console.error("  - Check CAP_TOKEN_ADDRESS is correct\n");

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
