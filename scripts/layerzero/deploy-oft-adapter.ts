import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

/**
 * Deploy OFTAdapter for CAP Token on Ethereum
 *
 * This script deploys the CAPTokenOFTAdapter on Ethereum (source chain)
 * The adapter locks CAP tokens and enables cross-chain transfers via LayerZero
 *
 * Prerequisites:
 * 1. CAP token already deployed on Ethereum
 * 2. LayerZero endpoint available on the network
 * 3. Governance address configured
 *
 * Post-deployment:
 * 1. Add adapter address as a pool in CAP token (to exempt from taxes)
 * 2. Configure peer connections to destination chains
 * 3. Set send/receive libraries if needed
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🚀 Deploying CAPTokenOFTAdapter on", network.name);
  console.log("==================================================\n");
  console.log("Deployer address:", deployer.address);
  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);

  // Network-specific configuration
  const config: {
    [key: string]: { capToken: string; lzEndpoint: string; governance: string };
  } = {
    // Ethereum Mainnet
    "1": {
      capToken: process.env.MAINNET_CAP_TOKEN_ADDRESS || "",
      lzEndpoint: "0x1a44076050125825900e736c501f859c50fE728c", // LayerZero V2 Endpoint
      governance: process.env.MAINNET_OWNER_ADDRESS || deployer.address,
    },
    // Sepolia Testnet
    "11155111": {
      capToken: process.env.SEPOLIA_CAP_TOKEN_ADDRESS || "0xA6B680A88c16056de7194CF775D04A45D0692C11",
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f", // LayerZero V2 Endpoint
      governance: process.env.SEPOLIA_OWNER_ADDRESS || process.env.TESTNET_OWNER_ADDRESS || deployer.address,
    },
  };

  const chainId = network.chainId.toString();
  const networkConfig = config[chainId];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network.name} (Chain ID: ${chainId})`);
  }

  const { capToken, lzEndpoint, governance } = networkConfig;

  if (!capToken || capToken === "") {
    throw new Error(
      "CAP token address not configured. Set MAINNET_CAP_TOKEN_ADDRESS or SEPOLIA_CAP_TOKEN_ADDRESS in .env"
    );
  }

  console.log("\nConfiguration:");
  console.log("- CAP Token:", capToken);
  console.log("- LayerZero Endpoint:", lzEndpoint);
  console.log("- Owner (Governance):", governance);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("\nDeployer balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("\n❌ ERROR: Deployer has no ETH!");
    console.log("\n🚰 Get testnet ETH from faucets:");
    if (network.chainId === 11155111n) {
      console.log("- QuickNode: https://faucet.quicknode.com/ethereum/sepolia");
      console.log("- Alchemy: https://www.alchemy.com/faucets/ethereum-sepolia");
      console.log("- Chainlink: https://faucets.chain.link/sepolia");
    }
    throw new Error("Please fund the deployer account");
  }

  // Estimate deployment cost
  const OFTAdapter = await ethers.getContractFactory("CAPTokenOFTAdapter");
  const deployTx = OFTAdapter.getDeployTransaction(capToken, lzEndpoint, governance);
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  const feeData = await ethers.provider.getFeeData();
  const estimatedCost = estimatedGas * (feeData.gasPrice || feeData.maxFeePerGas || 0n);

  console.log("\n⛽ Gas Estimation:");
  console.log("- Estimated gas:", estimatedGas.toString());
  console.log("- Gas price:", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");
  console.log("- Estimated cost:", ethers.formatEther(estimatedCost), "ETH");
  console.log("- Balance after deploy:", ethers.formatEther(balance - estimatedCost), "ETH (estimated)");

  if (balance < estimatedCost) {
    console.error("\n❌ ERROR: Insufficient balance for deployment!");
    console.log("Need:", ethers.formatEther(estimatedCost), "ETH");
    console.log("Have:", ethers.formatEther(balance), "ETH");
    console.log("Short:", ethers.formatEther(estimatedCost - balance), "ETH");
    throw new Error("Insufficient balance");
  }

  if (balance < estimatedCost * 2n) {
    console.log(
      "\n⚠️  WARNING: Balance is low. You have enough for deployment but may not have enough for peer configuration."
    );
    console.log("Recommended balance:", ethers.formatEther(estimatedCost * 2n), "ETH");
  }

  // Deploy OFTAdapter
  console.log("\n📝 Deploying CAPTokenOFTAdapter...");
  const oftAdapter = await OFTAdapter.deploy(capToken, lzEndpoint, governance);

  await oftAdapter.waitForDeployment();
  const adapterAddress = await oftAdapter.getAddress();

  console.log("✅ CAPTokenOFTAdapter deployed at:", adapterAddress);

  // Verification info
  console.log("\n==================================================");
  console.log("📋 Deployment Summary");
  console.log("==================================================");
  console.log("Network:", network.name);
  console.log("OFTAdapter:", adapterAddress);
  console.log("CAP Token:", capToken);
  console.log("LayerZero Endpoint:", lzEndpoint);
  console.log("Owner:", governance);

  console.log("\n==================================================");
  console.log("📝 Next Steps");
  console.log("==================================================");
  console.log("1. Verify contract on Etherscan:");
  console.log(
    `   npx hardhat verify --network ${network.name} ${adapterAddress} ${capToken} ${lzEndpoint} ${governance}`
  );
  console.log("\n2. ⚠️  IMPORTANT: DO NOT add adapter as pool in CAP token");
  console.log("   ❌ DO NOT RUN: capToken.addPool(adapter)");
  console.log("   ✅ REASON: Keeping adapter as non-pool = 1% tax (better than 2% as pool)");
  console.log("   📌 Users will pay 1% bridge fee - this is intentional");
  console.log("\n3. Deploy OFT contracts on destination chains");
  console.log("   npm run deploy:oft -- --network arbitrum");
  console.log("\n4. Configure peer connections:");
  console.log("   npm run configure:oft-peers");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    oftAdapter: adapterAddress,
    capToken: capToken,
    lzEndpoint: lzEndpoint,
    owner: governance,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
  };

  console.log("\n📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
