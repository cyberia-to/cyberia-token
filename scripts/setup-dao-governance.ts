import { ethers } from "hardhat";
import deployments from "../deployments.json";

async function main() {
  const network = "sepolia";
  const deployment = deployments.deployments[network];

  if (!deployment) {
    throw new Error(`No deployment found for network: ${network}`);
  }

  const [signer] = await ethers.getSigners();
  console.log("🔐 Connected wallet:", signer.address);
  console.log("");

  // Get addresses from environment
  const daoAddress = process.env.ARAGON_DAO_ADDRESS;
  const pluginAddress = process.env.CAP_GOVERNANCE_PLUGIN_ADDRESS;
  const capTokenAddress = deployment.proxyAddress;

  if (!daoAddress || !pluginAddress) {
    throw new Error("ARAGON_DAO_ADDRESS or CAP_GOVERNANCE_PLUGIN_ADDRESS not set in .env");
  }

  console.log("📋 Configuration:");
  console.log("├─ CAP Token:", capTokenAddress);
  console.log("├─ Aragon DAO:", daoAddress);
  console.log("└─ Governance Plugin:", pluginAddress);
  console.log("");

  // Get CAP token contract
  const cap = await ethers.getContractAt("CAPToken", capTokenAddress);

  // =============================================================================
  // STEP 1: Check and Transfer Ownership
  // =============================================================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 1: Transfer Token Ownership to DAO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const currentOwner = await cap.owner();
  console.log("Current owner:", currentOwner);
  console.log("Target DAO:", daoAddress);

  if (currentOwner.toLowerCase() === daoAddress.toLowerCase()) {
    console.log("✅ DAO already owns the token!");
  } else if (currentOwner.toLowerCase() === signer.address.toLowerCase()) {
    console.log("");
    console.log("🔄 Transferring ownership to DAO...");
    const tx = await cap.transferOwnership(daoAddress);
    console.log("📤 Transaction sent:", tx.hash);

    await tx.wait();
    console.log("✅ Ownership transferred successfully!");

    // Verify
    const newOwner = await cap.owner();
    console.log("✅ Verified new owner:", newOwner);
    console.log("");
    console.log("⚠️  IMPORTANT: All admin functions now require DAO governance!");
  } else {
    console.log("❌ ERROR: You are not the current owner!");
    console.log(`   Current owner: ${currentOwner}`);
    console.log(`   Your address: ${signer.address}`);
    console.log("");
    console.log("⏭️  Skipping ownership transfer...");
  }

  console.log("");

  // =============================================================================
  // STEP 2: Delegate Voting Power
  // =============================================================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 2: Activate Voting Power");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Check current delegation
  const currentDelegate = await cap.delegates(signer.address);
  console.log("Current delegate:", currentDelegate);

  if (currentDelegate.toLowerCase() === signer.address.toLowerCase()) {
    console.log("✅ Voting power already activated (self-delegated)!");
  } else {
    console.log("");
    console.log("🗳️  Self-delegating to activate voting power...");
    const tx = await cap.delegate(signer.address);
    console.log("📤 Transaction sent:", tx.hash);

    await tx.wait();
    console.log("✅ Voting power activated!");
  }

  // Check voting power
  const balance = await cap.balanceOf(signer.address);
  const votes = await cap.getVotes(signer.address);

  console.log("");
  console.log("📊 Your Voting Power:");
  console.log("├─ Balance:", ethers.formatEther(balance), "CAP");
  console.log("└─ Votes:", ethers.formatEther(votes), "CAP");

  console.log("");

  // =============================================================================
  // STEP 3: Display Current Token State
  // =============================================================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEP 3: Current Token State");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const totalSupply = await cap.totalSupply();
  const owner = await cap.owner();
  const feeRecipient = await cap.feeRecipient();
  const transferTax = await cap.transferTaxBp();
  const sellTax = await cap.sellTaxBp();
  const buyTax = await cap.buyTaxBp();

  console.log("Token Information:");
  console.log("├─ Name:", await cap.name());
  console.log("├─ Symbol:", await cap.symbol());
  console.log("├─ Total Supply:", ethers.formatEther(totalSupply), "CAP");
  console.log("└─ Decimals:", await cap.decimals());
  console.log("");
  console.log("Governance:");
  console.log("└─ Owner (DAO):", owner);
  console.log("");
  console.log("Tax Configuration:");
  console.log("├─ Transfer Tax:", transferTax, "bp (", Number(transferTax) / 100, "%)");
  console.log("├─ Sell Tax:", sellTax, "bp (", Number(sellTax) / 100, "%)");
  console.log("└─ Buy Tax:", buyTax, "bp (", Number(buyTax) / 100, "%)");
  console.log("");
  console.log("Fee Recipient:");
  console.log("└─", feeRecipient);

  // Check for pending tax changes
  const pendingTimestamp = await cap.taxChangeTimestamp();
  if (pendingTimestamp > 0) {
    const pendingTransfer = await cap.pendingTransferTaxBp();
    const pendingSell = await cap.pendingSellTaxBp();
    const pendingBuy = await cap.pendingBuyTaxBp();

    console.log("");
    console.log("⏳ Pending Tax Change:");
    console.log("├─ Transfer Tax:", pendingTransfer, "bp");
    console.log("├─ Sell Tax:", pendingSell, "bp");
    console.log("├─ Buy Tax:", pendingBuy, "bp");
    console.log("└─ Ready at:", new Date(Number(pendingTimestamp) * 1000).toLocaleString());
  }

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ DAO Governance Setup Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("🎯 Next Steps:");
  console.log("1. Visit your DAO:");
  console.log(`   https://app.aragon.org/#/daos/sepolia/${daoAddress}`);
  console.log("");
  console.log("2. Create your first proposal to test governance");
  console.log("");
  console.log("3. Other token holders should also delegate their voting power:");
  console.log("   npx hardhat run scripts/delegate-voting-power.ts --network sepolia");
  console.log("");
  console.log("📚 Documentation:");
  console.log("   - Governance Guide: docs/GOVERNANCE.md");
  console.log("   - Aragon Integration: docs/aragon-integration.md");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
