import { ethers, upgrades, network } from "hardhat";
import { getNetworkConfig, getDeploymentConfig, validateEnvironment } from "./config/environments";
import { saveDeployment } from "./utils/deployment-tracker";
import { runPostDeploymentUpdates } from "./utils/post-deployment";

interface DeployConfig {
  owner: string;
  feeRecipient: string;
}

async function validateConfig(networkName: string): Promise<DeployConfig> {
  // Validate the environment
  validateEnvironment(networkName);

  // Get deployment configuration for this network
  const config = getDeploymentConfig(networkName);

  // Validate addresses
  if (!ethers.isAddress(config.owner)) {
    throw new Error(`Invalid OWNER_ADDRESS: ${config.owner}`);
  }

  if (config.feeRecipient !== "0x0000000000000000000000000000000000000000" && !ethers.isAddress(config.feeRecipient)) {
    throw new Error(`Invalid FEE_RECIPIENT: ${config.feeRecipient}`);
  }

  return config;
}

async function deployContract(config: DeployConfig, networkName: string) {
  const networkConfig = getNetworkConfig(networkName);

  console.log("🚀 Deploying Cyberia (CAP) Token...");
  console.log(`🌐 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
  console.log(`📋 Owner: ${config.owner}`);
  console.log(
    `💰 Fee Recipient: ${config.feeRecipient === "0x0000000000000000000000000000000000000000" ? "Burn Mode" : config.feeRecipient}`
  );

  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💵 Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  const contractFactory = await ethers.getContractFactory("CAPToken");

  console.log("\n⏳ Deploying proxy contract...");
  const contract = await upgrades.deployProxy(contractFactory, [config.owner, config.feeRecipient], {
    kind: "uups",
    initializer: "initialize",
  });

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();

  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  // Get deployment transaction details
  const deployTx = contract.deploymentTransaction();
  if (!deployTx) {
    throw new Error("Deployment transaction not found");
  }

  const receipt = await deployTx.wait(networkConfig.confirmations);
  if (!receipt) {
    throw new Error("Transaction receipt not found");
  }

  console.log(`✅ CAP Token deployed successfully!`);
  console.log(`📍 Proxy Address: ${proxyAddress}`);
  console.log(`📍 Implementation Address: ${implementationAddress}`);
  console.log(`📝 Transaction Hash: ${receipt.hash}`);
  console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

  return {
    contract,
    proxyAddress,
    implementationAddress,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployer: deployer.address,
  };
}

async function verifyDeployment(address: string, config: DeployConfig) {
  console.log("\n🔍 Verifying deployment...");

  const contract = await ethers.getContractAt("CAPToken", address);

  const name = await contract.name();
  const symbol = await contract.symbol();
  const totalSupply = await contract.totalSupply();
  const governance = await contract.governance();
  const feeRecipient = await contract.feeRecipient();

  console.log(`Token Name: ${name}`);
  console.log(`Token Symbol: ${symbol}`);
  console.log(`Total Supply: ${ethers.formatEther(totalSupply)} CAP`);
  console.log(`Governance: ${governance}`);
  console.log(`Fee Recipient: ${feeRecipient}`);

  // Validate deployment
  if (name !== "Cyberia") throw new Error("Invalid token name");
  if (symbol !== "CAP") throw new Error("Invalid token symbol");
  if (governance !== config.owner) throw new Error("Governance mismatch");
  if (feeRecipient !== config.feeRecipient) throw new Error("Fee recipient mismatch");

  console.log("✅ Deployment verification passed!");
}

async function main() {
  try {
    const networkName = network.name;
    const networkConfig = getNetworkConfig(networkName);

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║         CYBERIA (CAP) TOKEN DEPLOYMENT SCRIPT                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const config = await validateConfig(networkName);
    const deployment = await deployContract(config, networkName);
    await verifyDeployment(deployment.proxyAddress, config);

    // Save deployment record
    const deploymentRecord = {
      network: networkName,
      chainId: networkConfig.chainId,
      timestamp: new Date().toISOString(),
      proxyAddress: deployment.proxyAddress,
      implementationAddress: deployment.implementationAddress,
      deployer: deployment.deployer,
      owner: config.owner,
      feeRecipient: config.feeRecipient,
      txHash: deployment.txHash,
      blockNumber: deployment.blockNumber,
      verified: false,
    };

    saveDeployment(networkName, deploymentRecord);

    // Run post-deployment updates (auto-update .env, README, etc.)
    await runPostDeploymentUpdates(networkName, deploymentRecord);

    console.log("\n🎉 Deployment completed successfully!");
    console.log(`\n📝 Next steps:`);

    if (networkConfig.isTestnet || networkName === "mainnet") {
      console.log(`1. Verify contract on Etherscan:`);
      console.log(`   npx hardhat verify --network ${networkName} ${deployment.proxyAddress}`);
      console.log(`\n2. View on Explorer:`);
      console.log(`   ${networkConfig.explorerUrl}/address/${deployment.proxyAddress}`);
    }

    console.log(`\n3. Update .env with deployed address:`);
    console.log(`   CAP_TOKEN_ADDRESS=${deployment.proxyAddress}`);
    console.log(`\n4. Configure pools and settings (if needed):`);
    console.log(`   npm run configure:${networkName}`);

    if (networkName === "mainnet") {
      console.log(`\n⚠️  IMPORTANT: This is a MAINNET deployment!`);
      console.log(`   - Save all addresses and transaction hashes securely`);
      console.log(`   - Transfer ownership to DAO governance when ready`);
      console.log(`   - Set up monitoring and alerts`);
    }
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exitCode = 1;
  }
}

main();
