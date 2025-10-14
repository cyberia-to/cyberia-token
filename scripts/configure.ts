import { ethers, network } from "hardhat";
import { getNetworkConfig } from "./config/environments";
import { getDeployment } from "./utils/deployment-tracker";

interface ConfigOptions {
  contractAddress: string;
  poolAddress?: string;
  newFeeRecipient?: string;
  taxes?: {
    transfer: number;
    sell: number;
    buy: number;
  };
}

async function validateConfig(networkName: string): Promise<ConfigOptions> {
  let contractAddress = process.env.CAP_TOKEN_ADDRESS;

  // Try to get address from deployment history if not provided
  if (!contractAddress) {
    console.log("📖 CAP_TOKEN_ADDRESS not set, checking deployment history...");
    const deployment = getDeployment(networkName);
    if (deployment) {
      contractAddress = deployment.proxyAddress;
      console.log(`✅ Found deployed contract for ${networkName}: ${contractAddress}`);
    } else {
      throw new Error(
        `CAP_TOKEN_ADDRESS not set and no deployment found for ${networkName}. ` +
          `Please set CAP_TOKEN_ADDRESS in .env or deploy first.`
      );
    }
  }

  const poolAddress = process.env.POOL_ADDRESS;
  const newFeeRecipient = process.env.NEW_FEE_RECIPIENT;

  if (!ethers.isAddress(contractAddress)) {
    throw new Error(`Invalid CAP_TOKEN_ADDRESS: ${contractAddress}`);
  }

  // Validate optional addresses
  if (poolAddress && !ethers.isAddress(poolAddress)) {
    throw new Error(`Invalid POOL_ADDRESS: ${poolAddress}`);
  }

  if (
    newFeeRecipient &&
    newFeeRecipient !== "0x0000000000000000000000000000000000000000" &&
    !ethers.isAddress(newFeeRecipient)
  ) {
    throw new Error(`Invalid NEW_FEE_RECIPIENT: ${newFeeRecipient}`);
  }

  return {
    contractAddress,
    poolAddress: poolAddress || undefined,
    newFeeRecipient: newFeeRecipient || undefined,
  };
}

async function getContractInstance(address: string) {
  try {
    const contract = await ethers.getContractAt("CAPToken", address);

    // Verify it's actually a CAP token
    const name = await contract.name();
    const symbol = await contract.symbol();

    if (name !== "Cyberia" || symbol !== "CAP") {
      throw new Error(`Contract at ${address} is not a CAP token (name: ${name}, symbol: ${symbol})`);
    }

    return contract;
  } catch (error) {
    throw new Error(`Failed to connect to contract at ${address}: ${error}`);
  }
}

async function addPool(contract: any, poolAddress: string) {
  console.log(`📝 Adding pool: ${poolAddress}`);

  // Check if pool is already added
  const isAlreadyPool = await contract.isPool(poolAddress);
  if (isAlreadyPool) {
    console.log("⚠️  Pool is already registered, skipping...");
    return;
  }

  const tx = await contract.addPool(poolAddress);
  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  await tx.wait();
  console.log("✅ Pool added successfully");
}

async function updateFeeRecipient(contract: any, newFeeRecipient: string) {
  const currentRecipient = await contract.feeRecipient();

  if (currentRecipient === newFeeRecipient) {
    console.log("⚠️  Fee recipient is already set to this address, skipping...");
    return;
  }

  console.log(
    `📝 Updating fee recipient to: ${newFeeRecipient === "0x0000000000000000000000000000000000000000" ? "Burn Mode" : newFeeRecipient}`
  );

  const tx = await contract.setFeeRecipient(newFeeRecipient);
  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  await tx.wait();
  console.log("✅ Fee recipient updated successfully");
}

async function updateTaxes(contract: any, taxes: { transfer: number; sell: number; buy: number }) {
  console.log(
    `📝 Updating taxes to: ${taxes.transfer / 100}% transfer, ${taxes.sell / 100}% sell, ${taxes.buy / 100}% buy`
  );

  // Validate tax ranges
  if (taxes.transfer > 500 || taxes.sell > 500 || taxes.buy > 500) {
    throw new Error("Tax rates cannot exceed 5% (500 basis points)");
  }

  const tx = await contract.setTaxes(taxes.transfer, taxes.sell, taxes.buy);
  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  await tx.wait();
  console.log("✅ Taxes updated successfully");
}

async function displayCurrentConfig(contract: any, options: ConfigOptions) {
  console.log("\n=== Current Configuration ===");

  const [transferTax, sellTax, buyTax, feeRecipient, owner] = await Promise.all([
    contract.transferTaxBp(),
    contract.sellTaxBp(),
    contract.buyTaxBp(),
    contract.feeRecipient(),
    contract.owner(),
  ]);

  console.log(`Contract Address: ${options.contractAddress}`);
  console.log(`Owner: ${owner}`);
  console.log(`Transfer Tax: ${Number(transferTax) / 100}% (${transferTax} bp)`);
  console.log(`Sell Tax: ${Number(sellTax) / 100}% (${sellTax} bp)`);
  console.log(`Buy Tax: ${Number(buyTax) / 100}% (${buyTax} bp)`);
  console.log(
    `Fee Recipient: ${feeRecipient === "0x0000000000000000000000000000000000000000" ? "Burn Mode" : feeRecipient}`
  );

  if (options.poolAddress) {
    const isPool = await contract.isPool(options.poolAddress);
    console.log(`Pool ${options.poolAddress} registered: ${isPool}`);
  }
}

async function main() {
  try {
    const networkName = network.name;
    const networkConfig = getNetworkConfig(networkName);

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║        CYBERIA (CAP) TOKEN CONFIGURATION SCRIPT               ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log(`🌐 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);

    const options = await validateConfig(networkName);
    const contract = await getContractInstance(options.contractAddress);

    console.log(`📍 Contract Address: ${options.contractAddress}\n`);

    const [signer] = await ethers.getSigners();
    console.log(`🔑 Signer: ${signer.address}`);

    // Verify signer is owner
    const owner = await contract.owner();
    if (signer.address !== owner) {
      console.warn(`\n⚠️  WARNING: Signer (${signer.address}) is not the contract owner (${owner})`);
      console.warn(`   Configuration operations will likely fail unless executed through governance.\n`);
    }

    // Execute configurations
    let operationsExecuted = 0;

    if (options.poolAddress) {
      await addPool(contract, options.poolAddress);
      operationsExecuted++;
    }

    if (options.newFeeRecipient) {
      await updateFeeRecipient(contract, options.newFeeRecipient);
      operationsExecuted++;
    }

    if (options.taxes) {
      await updateTaxes(contract, options.taxes);
      operationsExecuted++;
    }

    if (operationsExecuted === 0) {
      console.log("ℹ️  No configuration operations specified.");
      console.log("\nAvailable configuration options:");
      console.log("  - POOL_ADDRESS: Add AMM pool address");
      console.log("  - NEW_FEE_RECIPIENT: Update fee recipient");
      console.log("\nSet these in your .env file and run again.");
    }

    // Display final configuration
    await displayCurrentConfig(contract, options);

    console.log("\n🎉 Configuration completed successfully!");

    if (networkName === "mainnet") {
      console.log(`\n⚠️  IMPORTANT: Production configuration updated!`);
      console.log(`   - Verify all changes on Etherscan`);
      console.log(`   - Update DAO documentation`);
      console.log(`   - Notify team members`);
    }
  } catch (error) {
    console.error("\n❌ Configuration failed:", error);
    process.exitCode = 1;
  }
}

main();
