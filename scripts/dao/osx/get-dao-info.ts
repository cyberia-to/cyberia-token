/**
 * Get DAO and plugin information using OSx contracts
 *
 * This script queries your DAO to get detailed information about:
 * - DAO configuration
 * - Token Voting plugin settings
 * - Current voting power
 *
 * Usage:
 *   npm run dao:info
 *   or: npx hardhat run --network sepolia scripts/dao/osx/get-dao-info.ts
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              DAO Information Query                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📋 Configuration:");
  console.log("  Network:", network.name);
  console.log("  Address:", signer.address);
  console.log("  CAP Token:", process.env.CAP_TOKEN_ADDRESS);
  console.log("  DAO Address:", process.env.ARAGON_DAO_ADDRESS);
  console.log("  Token Voting Plugin:", process.env.CAP_GOVERNANCE_PLUGIN_ADDRESS);
  console.log("");

  // Validate environment
  if (!process.env.CAP_TOKEN_ADDRESS) {
    throw new Error("❌ CAP_TOKEN_ADDRESS not set in .env");
  }
  if (!process.env.ARAGON_DAO_ADDRESS) {
    throw new Error("❌ ARAGON_DAO_ADDRESS not set in .env");
  }

  const capTokenAddress = process.env.CAP_TOKEN_ADDRESS;
  const daoAddress = process.env.ARAGON_DAO_ADDRESS;
  const pluginAddress = process.env.CAP_GOVERNANCE_PLUGIN_ADDRESS;

  // Load CAP token
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    CAP TOKEN INFO");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const CAPToken = await ethers.getContractFactory("CAPToken");
  const capToken = CAPToken.attach(capTokenAddress);

  const name = await capToken.name();
  const symbol = await capToken.symbol();
  const totalSupply = await capToken.totalSupply();
  const governance = await capToken.governance();
  const transferTax = await capToken.transferTaxBp();
  const sellTax = await capToken.sellTaxBp();
  const buyTax = await capToken.buyTaxBp();
  const feeRecipient = await capToken.feeRecipient();

  console.log("📊 Token Details:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Total Supply:", ethers.formatEther(totalSupply), "CAP");
  console.log("  Governance:", governance);
  console.log("");

  console.log("💰 Tax Configuration:");
  console.log("  Transfer Tax:", Number(transferTax) / 100, "%");
  console.log("  Sell Tax:", Number(sellTax) / 100, "%");
  console.log("  Buy Tax:", Number(buyTax) / 100, "%");
  console.log("  Fee Recipient:", feeRecipient);
  console.log("");

  console.log("🗳️  Your Voting Power:");
  const balance = await capToken.balanceOf(signer.address);
  const votingPower = await capToken.getVotes(signer.address);
  const delegate = await capToken.delegates(signer.address);

  console.log("  Balance:", ethers.formatEther(balance), "CAP");
  console.log("  Voting Power:", ethers.formatEther(votingPower), "votes");
  console.log("  Delegated to:", delegate);
  console.log("  Delegated to self:", delegate.toLowerCase() === signer.address.toLowerCase() ? "✅ YES" : "❌ NO");
  console.log("");

  // DAO Info
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                      DAO INFO");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const daoABI = [
    "function hasPermission(address _where, address _who, bytes32 _permissionId, bytes memory _data) external view returns (bool)",
    "function daoURI() external view returns (string)",
  ];

  const dao = new ethers.Contract(daoAddress, daoABI, signer);

  console.log("🏛️  DAO Details:");
  console.log("  Address:", daoAddress);

  try {
    const daoURI = await dao.daoURI();
    console.log("  URI:", daoURI);
  } catch {
    console.log("  URI: (not set)");
  }

  console.log("  Governance transferred:", governance.toLowerCase() === daoAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  console.log("");

  console.log("🔗 DAO Links:");
  console.log("  Aragon App: https://app.aragon.org/dao/ethereum-sepolia/" + daoAddress);
  console.log("  Etherscan: https://sepolia.etherscan.io/address/" + daoAddress);
  console.log("");

  // Plugin info (if address provided)
  if (pluginAddress) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                 TOKEN VOTING PLUGIN INFO");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log("📋 Plugin Details:");
    console.log("  Address:", pluginAddress);
    console.log("  Type: Token Voting (Aragon OSx)");
    console.log("");

    console.log("🔗 Plugin Links:");
    console.log("  Etherscan: https://sepolia.etherscan.io/address/" + pluginAddress);
    console.log("  View in Aragon UI: https://app.aragon.org/dao/ethereum-sepolia/" + daoAddress + "/settings");
    console.log("");

    console.log("💡 To view plugin settings:");
    console.log("  Visit Aragon UI → Settings → Plugins → Token Voting");
    console.log("");
  } else {
    console.log("⚠️  CAP_GOVERNANCE_PLUGIN_ADDRESS not set in .env");
    console.log("   Find it in Aragon UI → Settings → Plugins");
    console.log("");
  }

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                  ✅ INFO RETRIEVED                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => {
    console.log("✅ Script completed successfully\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error.message);
    process.exit(1);
  });
