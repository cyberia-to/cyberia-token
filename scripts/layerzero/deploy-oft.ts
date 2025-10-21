import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

/**
 * Deploy OFT for CAP Token on Destination Chains
 *
 * This script deploys CAPTokenOFT on destination chains (Arbitrum, Optimism, Base, Polygon, etc.)
 * The OFT contract mints/burns tokens as they are bridged via LayerZero
 *
 * Prerequisites:
 * 1. OFTAdapter deployed on Ethereum
 * 2. LayerZero endpoint available on the destination network
 * 3. Governance/owner address configured
 *
 * Post-deployment:
 * 1. Configure peer connection to Ethereum's OFTAdapter
 * 2. Set send/receive libraries if needed
 * 3. Test bridging with small amounts
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🚀 Deploying CAPTokenOFT on", network.name);
  console.log("==================================================\n");
  console.log("Deployer address:", deployer.address);
  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);

  // Network-specific configuration
  // LayerZero V2 uses the same endpoint address across most chains
  const config: {
    [key: string]: { lzEndpoint: string; owner: string };
  } = {
    // Arbitrum One
    "42161": {
      lzEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
      owner: process.env.ARBITRUM_OWNER_ADDRESS || deployer.address,
    },
    // Arbitrum Sepolia (testnet)
    "421614": {
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      owner: process.env.ARBITRUM_SEPOLIA_OWNER_ADDRESS || process.env.TESTNET_OWNER_ADDRESS || deployer.address,
    },
    // Optimism
    "10": {
      lzEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
      owner: process.env.OPTIMISM_OWNER_ADDRESS || deployer.address,
    },
    // Optimism Sepolia (testnet)
    "11155420": {
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      owner: process.env.OPTIMISM_SEPOLIA_OWNER_ADDRESS || process.env.TESTNET_OWNER_ADDRESS || deployer.address,
    },
    // Base
    "8453": {
      lzEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
      owner: process.env.BASE_OWNER_ADDRESS || deployer.address,
    },
    // Base Sepolia (testnet)
    "84532": {
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      owner: process.env.BASE_SEPOLIA_OWNER_ADDRESS || process.env.TESTNET_OWNER_ADDRESS || deployer.address,
    },
    // Polygon
    "137": {
      lzEndpoint: "0x1a44076050125825900e736c501f859c50fE728c",
      owner: process.env.POLYGON_OWNER_ADDRESS || deployer.address,
    },
    // Polygon Amoy (testnet)
    "80002": {
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      owner: process.env.POLYGON_AMOY_OWNER_ADDRESS || process.env.TESTNET_OWNER_ADDRESS || deployer.address,
    },
  };

  const chainId = network.chainId.toString();
  const networkConfig = config[chainId];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network.name} (Chain ID: ${chainId})`);
  }

  const { lzEndpoint, owner } = networkConfig;

  console.log("\nConfiguration:");
  console.log("- LayerZero Endpoint:", lzEndpoint);
  console.log("- Owner:", owner);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("\nDeployer balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("\n❌ ERROR: Deployer has no ETH!");
    console.log("\n🚰 Get testnet ETH from faucets:");
    if (chainId === "421614") {
      // Arbitrum Sepolia
      console.log("- QuickNode: https://faucet.quicknode.com/arbitrum/sepolia");
      console.log("- Alchemy: https://www.alchemy.com/faucets/arbitrum-sepolia");
      console.log("- Chainlink: https://faucets.chain.link/arbitrum-sepolia");
    } else if (chainId === "11155420") {
      // Optimism Sepolia
      console.log("- QuickNode: https://faucet.quicknode.com/optimism/sepolia");
      console.log("- Alchemy: https://www.alchemy.com/faucets/optimism-sepolia");
    } else if (chainId === "84532") {
      // Base Sepolia
      console.log("- QuickNode: https://faucet.quicknode.com/base/sepolia");
      console.log("- Alchemy: https://www.alchemy.com/faucets/base-sepolia");
    } else if (chainId === "80002") {
      // Polygon Amoy
      console.log("- QuickNode: https://faucet.quicknode.com/polygon/amoy");
    }
    throw new Error("Please fund the deployer account");
  }

  // Estimate deployment cost
  const OFT = await ethers.getContractFactory("CAPTokenOFT");
  const deployTx = OFT.getDeployTransaction(lzEndpoint, owner);
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

  // Deploy OFT
  console.log("\n📝 Deploying CAPTokenOFT...");
  const oft = await OFT.deploy(lzEndpoint, owner);

  await oft.waitForDeployment();
  const oftAddress = await oft.getAddress();

  console.log("✅ CAPTokenOFT deployed at:", oftAddress);

  // Get token info
  const name = await oft.name();
  const symbol = await oft.symbol();
  const decimals = await oft.decimals();

  console.log("\nToken Info:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Decimals:", decimals);

  // Verification info
  console.log("\n==================================================");
  console.log("📋 Deployment Summary");
  console.log("==================================================");
  console.log("Network:", network.name);
  console.log("OFT:", oftAddress);
  console.log("LayerZero Endpoint:", lzEndpoint);
  console.log("Owner:", owner);

  console.log("\n==================================================");
  console.log("📝 Next Steps");
  console.log("==================================================");
  console.log("1. Verify contract on block explorer:");
  console.log(`   npx hardhat verify --network ${network.name} ${oftAddress} ${lzEndpoint} ${owner}`);
  console.log("\n2. Configure peer connection to Ethereum's OFTAdapter");
  console.log("   (Use configure-oft-peers.ts script)");
  console.log("\n3. Test bridging from Ethereum to this chain");
  console.log("   (Start with small amounts)");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    oft: oftAddress,
    lzEndpoint: lzEndpoint,
    owner: owner,
    token: {
      name: name,
      symbol: symbol,
      decimals: decimals.toString(), // Convert BigInt to string for JSON serialization
    },
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
