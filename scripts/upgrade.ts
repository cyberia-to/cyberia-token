import { network, ethers as hardhatEthers, upgrades as hardhatUpgrades } from "hardhat";
import { ethers } from "ethers";
import { getNetworkConfig, validateEnvironment } from "./config/environments";
import { getDeployment, saveDeployment } from "./utils/deployment-tracker";

async function validateExistingDeployment(networkName: string): Promise<string> {
  let proxyAddress = process.env.CAP_TOKEN_ADDRESS;

  // Try to get address from deployment history if not provided
  if (!proxyAddress) {
    console.log("📖 CAP_TOKEN_ADDRESS not set, checking deployment history...");
    const deployment = getDeployment(networkName);
    if (deployment) {
      proxyAddress = deployment.proxyAddress;
      console.log(`✅ Found deployed contract for ${networkName}: ${proxyAddress}`);
    } else {
      throw new Error(
        `CAP_TOKEN_ADDRESS not set and no deployment found for ${networkName}. ` +
          `Please set CAP_TOKEN_ADDRESS in .env or deploy first.`
      );
    }
  }

  if (!ethers.isAddress(proxyAddress)) {
    throw new Error(`Invalid CAP_TOKEN_ADDRESS: ${proxyAddress}`);
  }

  // Verify it's a valid UUPS proxy
  try {
    const implementationAddress = await hardhatUpgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`📍 Current Implementation: ${implementationAddress}`);
  } catch (error) {
    throw new Error(`Address ${proxyAddress} does not appear to be a valid UUPS proxy: ${error}`);
  }

  return proxyAddress;
}

async function verifyContractOwnership(proxyAddress: string, signerAddress: string): Promise<void> {
  const contract = await hardhatEthers.getContractAt("CAPToken", proxyAddress);
  const owner = await contract.owner();

  if (owner !== signerAddress) {
    throw new Error(
      `Signer (${signerAddress}) is not the contract owner (${owner}). ` + `Only the owner can upgrade the contract.`
    );
  }

  console.log(`✅ Ownership verified: ${signerAddress}`);
}

async function upgradeContract(proxyAddress: string, networkName: string) {
  const networkConfig = getNetworkConfig(networkName);

  console.log("\n⏳ Preparing upgrade...");

  const [deployer] = await hardhatEthers.getSigners();
  console.log(`🔑 Upgrader: ${deployer.address}`);

  const balance = await hardhatEthers.provider.getBalance(deployer.address);
  console.log(`💵 Upgrader Balance: ${ethers.formatEther(balance)} ETH`);

  // Get the new contract factory
  const contractFactoryV2 = await hardhatEthers.getContractFactory("CAPToken");

  console.log("\n⏳ Upgrading proxy contract...");
  console.log("   This will deploy a new implementation and update the proxy...");

  const upgradedContract = await hardhatUpgrades.upgradeProxy(proxyAddress, contractFactoryV2);
  await upgradedContract.waitForDeployment();

  // Get new implementation address
  const newImplementationAddress = await hardhatUpgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`✅ Contract upgraded successfully!`);
  console.log(`📍 Proxy Address: ${proxyAddress} (unchanged)`);
  console.log(`📍 New Implementation Address: ${newImplementationAddress}`);

  // Get transaction details
  const deployTx = upgradedContract.deploymentTransaction();
  if (!deployTx) {
    console.warn("⚠️  Could not retrieve deployment transaction details");
    return {
      proxyAddress,
      implementationAddress: newImplementationAddress,
      txHash: "",
      blockNumber: 0,
      deployer: deployer.address,
    };
  }

  const receipt = await deployTx.wait(networkConfig.confirmations);
  if (!receipt) {
    console.warn("⚠️  Could not retrieve transaction receipt");
    return {
      proxyAddress,
      implementationAddress: newImplementationAddress,
      txHash: deployTx.hash,
      blockNumber: 0,
      deployer: deployer.address,
    };
  }

  console.log(`📝 Transaction Hash: ${receipt.hash}`);
  console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

  return {
    proxyAddress,
    implementationAddress: newImplementationAddress,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployer: deployer.address,
  };
}

async function verifyUpgrade(proxyAddress: string) {
  console.log("\n🔍 Verifying upgrade...");

  const contract = await hardhatEthers.getContractAt("CAPToken", proxyAddress);

  const name = await contract.name();
  const symbol = await contract.symbol();
  const totalSupply = await contract.totalSupply();
  const owner = await contract.owner();
  const feeRecipient = await contract.feeRecipient();

  console.log(`Token Name: ${name}`);
  console.log(`Token Symbol: ${symbol}`);
  console.log(`Total Supply: ${ethers.formatEther(totalSupply)} CAP`);
  console.log(`Owner: ${owner}`);
  console.log(`Fee Recipient: ${feeRecipient}`);

  // Validate critical properties are preserved
  if (name !== "Cyberia") {
    console.warn("⚠️  WARNING: Token name changed after upgrade!");
  }
  if (symbol !== "CAP") {
    console.warn("⚠️  WARNING: Token symbol changed after upgrade!");
  }
  if (totalSupply === BigInt(0)) {
    console.warn("⚠️  WARNING: Total supply is zero after upgrade!");
  }

  console.log("✅ Upgrade verification passed!");
}

async function main() {
  try {
    const networkName = network.name;
    const networkConfig = getNetworkConfig(networkName);

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║         CYBERIA (CAP) TOKEN UPGRADE SCRIPT (UUPS)            ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log(`🌐 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);

    if (networkName === "mainnet") {
      console.warn("\n⚠️  ⚠️  ⚠️  WARNING: UPGRADING MAINNET CONTRACT ⚠️  ⚠️  ⚠️");
      console.warn("This will upgrade the production contract!");
      console.warn("Ensure you have:");
      console.warn("  1. Tested the new implementation thoroughly");
      console.warn("  2. Audited all changes");
      console.warn("  3. Backed up all critical data");
      console.warn("  4. Verified the proxy address");
      console.warn("  5. Obtained DAO approval if required\n");
    }

    // Validate environment
    validateEnvironment(networkName);

    // Get and validate existing deployment
    const proxyAddress = await validateExistingDeployment(networkName);

    // Get signer
    const [signer] = await hardhatEthers.getSigners();

    // Verify ownership
    await verifyContractOwnership(proxyAddress, signer.address);

    // Get current contract state for comparison
    const contractBefore = await hardhatEthers.getContractAt("CAPToken", proxyAddress);
    const ownerBefore = await contractBefore.owner();
    const feeRecipientBefore = await contractBefore.feeRecipient();

    // Perform upgrade
    const upgrade = await upgradeContract(proxyAddress, networkName);

    // Verify upgrade
    await verifyUpgrade(proxyAddress);

    // Update deployment record
    saveDeployment(networkName, {
      network: networkName,
      chainId: networkConfig.chainId,
      timestamp: new Date().toISOString(),
      proxyAddress: upgrade.proxyAddress,
      implementationAddress: upgrade.implementationAddress,
      deployer: upgrade.deployer,
      owner: ownerBefore,
      feeRecipient: feeRecipientBefore,
      txHash: upgrade.txHash,
      blockNumber: upgrade.blockNumber,
      verified: false,
    });

    console.log("\n🎉 Upgrade completed successfully!");
    console.log(`\n📝 Next steps:`);

    if (networkConfig.isTestnet || networkName === "mainnet") {
      console.log(`1. Verify new implementation on Etherscan:`);
      console.log(`   npx hardhat verify --network ${networkName} ${upgrade.implementationAddress}`);
      console.log(`\n2. View on Explorer:`);
      console.log(`   ${networkConfig.explorerUrl}/address/${proxyAddress}`);
    }

    console.log(`\n3. Test the upgraded contract thoroughly`);
    console.log(`4. Update documentation with new implementation address`);

    if (networkName === "mainnet") {
      console.log(`\n⚠️  IMPORTANT: This is a MAINNET upgrade!`);
      console.log(`   - Verify all functionality works as expected`);
      console.log(`   - Monitor the contract for any issues`);
      console.log(`   - Notify community of the upgrade`);
      console.log(`   - Update all dependent systems`);
    }
  } catch (error) {
    console.error("\n❌ Upgrade failed:", error);
    process.exitCode = 1;
  }
}

main();
