import { ethers, upgrades } from "hardhat";

interface DeployConfig {
  owner: string;
  feeRecipient: string;
}

async function validateConfig(): Promise<DeployConfig> {
  const owner = process.env.OWNER_ADDRESS;
  const feeRecipient = process.env.FEE_RECIPIENT;

  if (!owner) {
    throw new Error("OWNER_ADDRESS environment variable is required");
  }

  if (feeRecipient === undefined) {
    throw new Error("FEE_RECIPIENT environment variable is required (use 0x000...000 for burn mode)");
  }

  // Validate addresses
  if (!ethers.isAddress(owner)) {
    throw new Error(`Invalid OWNER_ADDRESS: ${owner}`);
  }

  if (feeRecipient !== "0x0000000000000000000000000000000000000000" && !ethers.isAddress(feeRecipient)) {
    throw new Error(`Invalid FEE_RECIPIENT: ${feeRecipient}`);
  }

  return { owner, feeRecipient };
}

async function deployContract(config: DeployConfig) {
  console.log("🚀 Deploying Cyberia (CAP) Token...");
  console.log(`📋 Owner: ${config.owner}`);
  console.log(`💰 Fee Recipient: ${config.feeRecipient === "0x0000000000000000000000000000000000000000" ? "Burn Mode" : config.feeRecipient}`);

  const contractFactory = await ethers.getContractFactory("CAPToken");

  const contract = await upgrades.deployProxy(
    contractFactory,
    [config.owner, config.feeRecipient],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`✅ CAP Token deployed successfully!`);
  console.log(`📍 Contract Address: ${address}`);

  return { contract, address };
}

async function verifyDeployment(address: string, config: DeployConfig) {
  console.log("\n🔍 Verifying deployment...");

  const contract = await ethers.getContractAt("CAPToken", address);

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

  // Validate deployment
  if (name !== "Cyberia") throw new Error("Invalid token name");
  if (symbol !== "CAP") throw new Error("Invalid token symbol");
  if (owner !== config.owner) throw new Error("Owner mismatch");
  if (feeRecipient !== config.feeRecipient) throw new Error("Fee recipient mismatch");

  console.log("✅ Deployment verification passed!");
}

async function main() {
  try {
    const config = await validateConfig();
    const { address } = await deployContract(config);
    await verifyDeployment(address, config);

    console.log("\n🎉 Deployment completed successfully!");
    console.log(`\n📝 Next steps:`);
    console.log(`1. Verify contract: npx hardhat verify --network <network> ${address}`);
    console.log(`2. Set CAP_TOKEN_ADDRESS=${address} in .env`);
    console.log(`3. Run configuration: npm run configure`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
  }
}

main();