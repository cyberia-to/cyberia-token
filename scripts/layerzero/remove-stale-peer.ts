import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

/**
 * Remove Stale Peer Configuration
 *
 * This script removes incorrect/stale peer configurations by setting them to zero address
 * Use this to clean up misconfigured peers from deployment errors
 */

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🧹 Removing Stale Peer Configuration");
  console.log("==================================================\n");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Signer:", signer.address);

  // Get OFT address based on network
  const chainId = network.chainId;
  let oftAddress = "";

  if (chainId === 421614n) {
    oftAddress = process.env.ARBITRUM_SEPOLIA_OFT_ADDRESS || "";
  } else if (chainId === 42161n) {
    oftAddress = process.env.ARBITRUM_OFT_ADDRESS || "";
  } else if (chainId === 11155420n) {
    oftAddress = process.env.OPTIMISM_SEPOLIA_OFT_ADDRESS || "";
  } else if (chainId === 10n) {
    oftAddress = process.env.OPTIMISM_OFT_ADDRESS || "";
  } else if (chainId === 84532n) {
    oftAddress = process.env.BASE_SEPOLIA_OFT_ADDRESS || "";
  } else if (chainId === 8453n) {
    oftAddress = process.env.BASE_OFT_ADDRESS || "";
  } else if (chainId === 80002n) {
    oftAddress = process.env.POLYGON_AMOY_OFT_ADDRESS || "";
  } else if (chainId === 137n) {
    oftAddress = process.env.POLYGON_OFT_ADDRESS || "";
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  if (!oftAddress) {
    throw new Error("OFT address not configured for this network");
  }

  console.log("\n📝 OFT Contract:", oftAddress);

  const oft = await ethers.getContractAt("CAPTokenOFT", oftAddress);

  // For testnets, remove mainnet Ethereum peer (EID 30101)
  // For mainnet, remove testnet Sepolia peer (EID 40161)
  const isTestnet =
    chainId === 421614n || // Arbitrum Sepolia
    chainId === 11155420n || // Optimism Sepolia
    chainId === 84532n || // Base Sepolia
    chainId === 80002n; // Polygon Amoy

  const staleEid = isTestnet ? 30101 : 40161; // Remove mainnet peer on testnet, vice versa
  const staleName = isTestnet ? "Ethereum Mainnet" : "Ethereum Sepolia";

  console.log(`\n🔍 Checking for stale peer: ${staleName} (EID ${staleEid})`);

  // Check if stale peer exists
  const currentPeer = await oft.peers(staleEid);

  if (currentPeer === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("✅ No stale peer found. Configuration is clean!");
    return;
  }

  const currentPeerAddress = "0x" + currentPeer.slice(-40);
  console.log(`⚠️  Found stale peer: ${currentPeerAddress}`);

  // Remove stale peer by setting to zero bytes32
  const zeroPeer = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log(`\n🧹 Removing stale peer for ${staleName} (EID ${staleEid})...`);

  try {
    const tx = await oft.setPeer(staleEid, zeroPeer);
    console.log("Transaction hash:", tx.hash);

    console.log("⏳ Waiting for confirmation...");
    await tx.wait();

    console.log("✅ Stale peer removed successfully!");

    // Verify removal
    const verifyPeer = await oft.peers(staleEid);
    if (verifyPeer === zeroPeer) {
      console.log("✅ Verified: Peer is now set to zero address");
    } else {
      console.log("⚠️  Warning: Peer may not have been removed correctly");
    }
  } catch (error) {
    console.error("❌ Failed to remove stale peer:", error);
    throw error;
  }

  console.log("\n==================================================");
  console.log("🎉 Cleanup Complete!");
  console.log("==================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
