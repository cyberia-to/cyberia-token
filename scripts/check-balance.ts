import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("💰 Wallet Balance Check");
  console.log("==================================================");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Wallet:", signer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("==================================================\n");

  if (balance === 0n) {
    console.log("⚠️  Wallet has no ETH on this network!");
    console.log("\nGet testnet ETH from faucets:");
    console.log("- QuickNode: https://faucet.quicknode.com/arbitrum/sepolia");
    console.log("- Alchemy: https://www.alchemy.com/faucets/arbitrum-sepolia");
    console.log("- Chainlink: https://faucets.chain.link/arbitrum-sepolia");
  } else {
    console.log("✅ Wallet is funded and ready to deploy!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
