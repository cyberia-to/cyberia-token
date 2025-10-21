import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

/**
 * Check OFT Balance on Destination Chain
 *
 * This script checks the CAP token balance on a destination chain (Arbitrum, Optimism, etc.)
 * Use this to verify tokens were received after bridging via LayerZero
 */

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("💰 Checking CAP Token Balance");
  console.log("==================================================\n");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Address:", signer.address);

  // Determine OFT address based on network
  let oftAddress = "";
  const chainId = network.chainId;

  if (chainId === 421614n) {
    // Arbitrum Sepolia
    oftAddress = process.env.ARBITRUM_SEPOLIA_OFT_ADDRESS || "";
  } else if (chainId === 42161n) {
    // Arbitrum
    oftAddress = process.env.ARBITRUM_OFT_ADDRESS || "";
  } else if (chainId === 11155420n) {
    // Optimism Sepolia
    oftAddress = process.env.OPTIMISM_SEPOLIA_OFT_ADDRESS || "";
  } else if (chainId === 10n) {
    // Optimism
    oftAddress = process.env.OPTIMISM_OFT_ADDRESS || "";
  } else if (chainId === 84532n) {
    // Base Sepolia
    oftAddress = process.env.BASE_SEPOLIA_OFT_ADDRESS || "";
  } else if (chainId === 8453n) {
    // Base
    oftAddress = process.env.BASE_OFT_ADDRESS || "";
  } else if (chainId === 80002n) {
    // Polygon Amoy
    oftAddress = process.env.POLYGON_AMOY_OFT_ADDRESS || "";
  } else if (chainId === 137n) {
    // Polygon
    oftAddress = process.env.POLYGON_OFT_ADDRESS || "";
  } else {
    throw new Error(`Unsupported network: ${network.name} (Chain ID: ${chainId})`);
  }

  if (!oftAddress || oftAddress === "") {
    throw new Error(`OFT address not configured for ${network.name}. Check your .env file.`);
  }

  console.log("OFT Address:", oftAddress);

  // Get OFT contract
  const oft = await ethers.getContractAt("CAPTokenOFT", oftAddress);

  // Get token info
  const name = await oft.name();
  const symbol = await oft.symbol();
  const decimals = await oft.decimals();
  const balance = await oft.balanceOf(signer.address);
  const totalSupply = await oft.totalSupply();

  console.log("\n📊 Token Information");
  console.log("==================================================");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals.toString());

  console.log("\n💰 Balance Information");
  console.log("==================================================");
  console.log("Your Balance:", ethers.formatEther(balance), symbol);
  console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);

  if (balance === 0n) {
    console.log("\n⚠️  You have no", symbol, "tokens on", network.name);
    console.log("\nPossible reasons:");
    console.log("1. Bridge transaction is still being processed (wait 1-2 minutes)");
    console.log("2. Bridge transaction failed (check LayerZero Scan)");
    console.log("3. No tokens have been bridged to this address yet");
    console.log("\nCheck LayerZero Scan:");
    console.log("https://layerzeroscan.com");
  } else {
    console.log("\n✅ You have", ethers.formatEther(balance), symbol, "on", network.name);
  }

  console.log("\n==================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
