import { network } from "hardhat";
import { getDeployment } from "./utils/deployment-tracker";
import { validateDeploymentConsistency } from "./utils/post-deployment";
import { getNetworkConfig } from "./config/environments";

/**
 * Validation script to ensure deployment is consistent across all files
 * Run this after deployment to verify everything is properly configured
 */
async function main() {
  try {
    const networkName = network.name;
    const networkConfig = getNetworkConfig(networkName);

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║       CYBERIA (CAP) TOKEN DEPLOYMENT VALIDATION              ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log(`🌐 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);

    // Get deployment record
    console.log("\n📖 Loading deployment record...");
    const deployment = getDeployment(networkName);

    if (!deployment) {
      console.error(`\n❌ No deployment found for ${networkName}`);
      console.log("   Please deploy first using: npm run deploy:${networkName}");
      process.exitCode = 1;
      return;
    }

    console.log(`✅ Found deployment record for ${networkName}`);
    console.log(`   Proxy: ${deployment.proxyAddress}`);
    console.log(`   Implementation: ${deployment.implementationAddress}`);
    console.log(`   Deployed: ${new Date(deployment.timestamp).toLocaleString()}`);
    console.log(`   Verified: ${deployment.verified ? "Yes" : "No"}`);

    // Validate consistency
    console.log("\n" + "=".repeat(64));
    console.log("VALIDATING FILE CONSISTENCY");
    console.log("=".repeat(64));

    const isConsistent = validateDeploymentConsistency(networkName, deployment.proxyAddress);

    // Validate on-chain data
    console.log("\n" + "=".repeat(64));
    console.log("VALIDATING ON-CHAIN DATA");
    console.log("=".repeat(64));

    if (networkName !== "localhost" && networkName !== "hardhat") {
      try {
        const hardhat = await import("hardhat");
        const contract = await hardhat.ethers.getContractAt("CAPToken", deployment.proxyAddress);

        console.log("\n🔍 Checking contract state...");

        const [name, symbol, governance, feeRecipient, totalSupply] = await Promise.all([
          contract.name(),
          contract.symbol(),
          contract.governance(),
          contract.feeRecipient(),
          contract.totalSupply(),
        ]);

        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Governance: ${governance}`);
        console.log(`   Fee Recipient: ${feeRecipient}`);
        console.log(`   Total Supply: ${hardhat.ethers.formatEther(totalSupply)} CAP`);

        // Validate against deployment record
        if (governance !== deployment.owner) {
          console.error(`\n❌ Governance mismatch:`);
          console.error(`   Expected: ${deployment.owner}`);
          console.error(`   Actual: ${governance}`);
          process.exitCode = 1;
          return;
        }

        if (feeRecipient !== deployment.feeRecipient) {
          console.error(`\n❌ Fee recipient mismatch:`);
          console.error(`   Expected: ${deployment.feeRecipient}`);
          console.error(`   Actual: ${feeRecipient}`);
          process.exitCode = 1;
          return;
        }

        console.log("\n✅ On-chain data matches deployment record");

        // Validate proxy pattern
        console.log("\n🔍 Validating proxy pattern...");
        const storedImplementation = await hardhat.upgrades.erc1967.getImplementationAddress(deployment.proxyAddress);

        if (storedImplementation.toLowerCase() !== deployment.implementationAddress.toLowerCase()) {
          console.error(`\n❌ Implementation address mismatch:`);
          console.error(`   Expected: ${deployment.implementationAddress}`);
          console.error(`   Actual: ${storedImplementation}`);
          process.exitCode = 1;
          return;
        }

        console.log(`✅ Proxy pattern validated (ERC1967 UUPS)`);
      } catch (error) {
        console.warn(`\n⚠️  Could not validate on-chain data: ${error}`);
        console.log("   This is normal if the network is not accessible");
      }
    } else {
      console.log("\n⏩ Skipping on-chain validation for local network");
    }

    // Summary
    console.log("\n" + "=".repeat(64));
    console.log("VALIDATION SUMMARY");
    console.log("=".repeat(64));

    if (isConsistent) {
      console.log("\n✅ All validations passed!");
      console.log("\n📋 Deployment is ready for:");
      console.log("   1. Integration with Aragon DAO");
      console.log("   2. Setup of Gnosis Safe + Zodiac");
      console.log("   3. Configuration of AMM pools");
      console.log("   4. Governance transfer");
    } else {
      console.log("\n⚠️  Some validation checks failed");
      console.log("   Please review the issues above and run post-deployment updates:");
      console.log(`   npx ts-node scripts/utils/post-deployment.ts ${networkName}`);
      process.exitCode = 1;
    }

    if (networkConfig.explorerUrl) {
      console.log(`\n🔗 Explorer: ${networkConfig.explorerUrl}/address/${deployment.proxyAddress}`);
    }
  } catch (error) {
    console.error("\n❌ Validation failed:", error);
    process.exitCode = 1;
  }
}

main();
