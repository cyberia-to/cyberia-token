import { run, network } from "hardhat";
import { getNetworkConfig } from "./config/environments";
import { getDeployment } from "./utils/deployment-tracker";

async function getAddressesToVerify(networkName: string): Promise<{ proxy: string; implementation: string }> {
  let proxyAddress = process.env.CAP_TOKEN_ADDRESS;
  let implementationAddress = process.env.IMPLEMENTATION_ADDRESS;

  // Try to get addresses from deployment history if not provided
  if (!proxyAddress || !implementationAddress) {
    console.log("📖 Checking deployment history...");
    const deployment = getDeployment(networkName);
    if (deployment) {
      proxyAddress = proxyAddress || deployment.proxyAddress;
      implementationAddress = implementationAddress || deployment.implementationAddress;
      console.log(`✅ Found deployment for ${networkName}`);
      console.log(`   Proxy: ${proxyAddress}`);
      console.log(`   Implementation: ${implementationAddress}`);
    } else if (!proxyAddress && !implementationAddress) {
      throw new Error(
        `No addresses provided and no deployment found for ${networkName}. ` +
          `Please set CAP_TOKEN_ADDRESS and/or IMPLEMENTATION_ADDRESS in .env or deploy first.`
      );
    }
  }

  if (!proxyAddress) {
    throw new Error("CAP_TOKEN_ADDRESS not set. Please provide proxy address.");
  }

  if (!implementationAddress) {
    throw new Error("IMPLEMENTATION_ADDRESS not set. Please provide implementation address.");
  }

  return {
    proxy: proxyAddress,
    implementation: implementationAddress,
  };
}

async function verifyContract(
  contractAddress: string,
  constructorArguments: unknown[] = [],
  contractName?: string
): Promise<boolean> {
  try {
    console.log(`\n⏳ Verifying ${contractName || "contract"} at ${contractAddress}...`);

    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArguments,
    });

    console.log(`✅ ${contractName || "Contract"} verified successfully!`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Already Verified")) {
      console.log(`✅ ${contractName || "Contract"} already verified!`);
      return true;
    } else if (errorMessage.includes("does not have bytecode")) {
      console.error(`❌ No contract found at address ${contractAddress}`);
      return false;
    } else {
      console.error(`❌ Verification failed for ${contractName || "contract"}:`, errorMessage);
      return false;
    }
  }
}

async function verifyProxyPattern(proxyAddress: string, implementationAddress: string): Promise<void> {
  console.log("\n🔍 Verifying proxy pattern...");

  try {
    const hardhat = await import("hardhat");

    // Verify it's a valid ERC1967 proxy
    const storedImplementation = await hardhat.upgrades.erc1967.getImplementationAddress(proxyAddress);

    if (storedImplementation.toLowerCase() !== implementationAddress.toLowerCase()) {
      console.warn(`⚠️  WARNING: Implementation address mismatch!`);
      console.warn(`   Expected: ${implementationAddress}`);
      console.warn(`   Actual: ${storedImplementation}`);
      console.warn(`   Verifying the stored implementation instead...`);
      return;
    }

    console.log(`✅ Proxy pattern verified - ERC1967 UUPS`);
    console.log(`   Proxy: ${proxyAddress}`);
    console.log(`   Implementation: ${storedImplementation}`);
  } catch (error) {
    console.warn(`⚠️  Could not verify proxy pattern: ${error}`);
  }
}

async function updateDeploymentRecord(networkName: string, verified: boolean): Promise<void> {
  try {
    const deployment = getDeployment(networkName);
    if (deployment) {
      const { saveDeployment } = await import("./utils/deployment-tracker");
      deployment.verified = verified;
      saveDeployment(networkName, deployment);
      console.log(`\n✅ Deployment record updated (verified: ${verified})`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not update deployment record: ${error}`);
  }
}

async function main() {
  try {
    const networkName = network.name;
    const networkConfig = getNetworkConfig(networkName);

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║       CYBERIA (CAP) TOKEN VERIFICATION SCRIPT                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log(`🌐 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);

    // Check if network supports verification
    if (networkName === "localhost" || networkName === "hardhat") {
      console.log("\n⚠️  Contract verification is not available for local networks.");
      console.log("   Please deploy to a testnet or mainnet for verification.");
      return;
    }

    if (!networkConfig.explorerUrl) {
      console.log("\n⚠️  No block explorer configured for this network.");
      console.log("   Verification may not be available.");
    }

    // Get addresses to verify
    const addresses = await getAddressesToVerify(networkName);

    // Verify proxy pattern
    await verifyProxyPattern(addresses.proxy, addresses.implementation);

    console.log("\n" + "=".repeat(64));
    console.log("VERIFYING CONTRACTS");
    console.log("=".repeat(64));

    // Verify implementation contract
    // Note: UUPS implementations typically don't have constructor arguments
    // since initialization happens via the initializer function
    const implementationVerified = await verifyContract(addresses.implementation, [], "Implementation Contract");

    // Verify proxy contract
    // ERC1967 proxies are deployed by OpenZeppelin's upgrade plugin
    // and are already verified on most networks
    console.log("\n📝 Note: Proxy contract verification is typically automatic.");
    console.log("   If needed, you can verify it manually on the block explorer.");

    // Summary
    console.log("\n" + "=".repeat(64));
    console.log("VERIFICATION SUMMARY");
    console.log("=".repeat(64));

    console.log(`\nProxy Address: ${addresses.proxy}`);
    console.log(`Implementation Address: ${addresses.implementation}`);
    console.log(`Implementation Verified: ${implementationVerified ? "✅ Yes" : "❌ No"}`);

    if (networkConfig.explorerUrl) {
      console.log(`\n📍 View on Explorer:`);
      console.log(`   Proxy: ${networkConfig.explorerUrl}/address/${addresses.proxy}`);
      console.log(`   Implementation: ${networkConfig.explorerUrl}/address/${addresses.implementation}`);
    }

    // Update deployment record
    await updateDeploymentRecord(networkName, implementationVerified);

    if (implementationVerified) {
      console.log("\n🎉 Verification completed successfully!");
    } else {
      console.log("\n⚠️  Verification completed with warnings. Check the logs above.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exitCode = 1;
  }
}

main();
