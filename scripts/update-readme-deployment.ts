import * as fs from "fs";
import * as path from "path";
import { getDeployment } from "./utils/deployment-tracker";

interface DeploymentInfo {
  proxyAddress: string;
  implementationAddress: string;
  verified: boolean;
  timestamp?: string;
  explorerUrl: string;
}

function getNetworkExplorerUrl(network: string): string {
  switch (network) {
    case "sepolia":
      return "https://sepolia.etherscan.io";
    case "mainnet":
      return "https://etherscan.io";
    default:
      return "https://etherscan.io";
  }
}

function getDeploymentInfo(network: string): DeploymentInfo | null {
  const deployment = getDeployment(network);
  if (!deployment) {
    return null;
  }

  return {
    proxyAddress: deployment.proxyAddress,
    implementationAddress: deployment.implementationAddress,
    verified: deployment.verified || false,
    timestamp: deployment.timestamp,
    explorerUrl: getNetworkExplorerUrl(network),
  };
}

function formatDeploymentSection(network: string, info: DeploymentInfo): string {
  const networkName = network.charAt(0).toUpperCase() + network.slice(1);
  const verifiedBadge = info.verified ? " ✅" : " ⚠️ (pending verification)";
  const timestamp = info.timestamp ? ` - Deployed ${new Date(info.timestamp).toLocaleDateString()}` : "";

  return `### ${networkName}${network === "mainnet" ? "" : " Testnet"}

- **Proxy**: [\`${info.proxyAddress}\`](${info.explorerUrl}/address/${info.proxyAddress})
- **Implementation**: [\`${info.implementationAddress}\`](${info.explorerUrl}/address/${info.implementationAddress})
- **Status**: Verified${verifiedBadge}${timestamp}`;
}

function updateReadme(): void {
  const readmePath = path.join(__dirname, "..", "README.md");

  if (!fs.existsSync(readmePath)) {
    console.error("❌ README.md not found");
    process.exit(1);
  }

  let content = fs.readFileSync(readmePath, "utf-8");

  // Find the "Deployed Contracts" section
  const sectionStart = content.indexOf("## Deployed Contracts");
  if (sectionStart === -1) {
    console.error("❌ Could not find '## Deployed Contracts' section in README");
    process.exit(1);
  }

  // Find the next section (usually "## Documentation")
  const nextSectionMatch = content.slice(sectionStart + 1).match(/\n## /);
  const sectionEnd = nextSectionMatch ? sectionStart + 1 + nextSectionMatch.index! : content.length;

  // Build new deployment section
  let newSection = "## Deployed Contracts\n\n";

  // Check Sepolia
  const sepoliaInfo = getDeploymentInfo("sepolia");
  if (sepoliaInfo) {
    newSection += formatDeploymentSection("sepolia", sepoliaInfo) + "\n\n";
  } else {
    newSection += "### Sepolia Testnet\n\n- Not deployed yet\n\n";
  }

  // Check Mainnet
  const mainnetInfo = getDeploymentInfo("mainnet");
  if (mainnetInfo) {
    newSection += formatDeploymentSection("mainnet", mainnetInfo) + "\n\n";
  } else {
    newSection += "### Mainnet\n\n- Not deployed yet\n\n";
  }

  // Replace the section
  const newContent = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);

  // Write back
  fs.writeFileSync(readmePath, newContent);

  console.log("✅ README.md updated successfully");
  console.log("\nDeployment status:");
  if (sepoliaInfo) {
    console.log(`  ✅ Sepolia: ${sepoliaInfo.proxyAddress}`);
  } else {
    console.log(`  ⏸️  Sepolia: Not deployed`);
  }
  if (mainnetInfo) {
    console.log(`  ✅ Mainnet: ${mainnetInfo.proxyAddress}`);
  } else {
    console.log(`  ⏸️  Mainnet: Not deployed`);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    updateReadme();
  } catch (error) {
    console.error("❌ Error updating README:", error);
    process.exit(1);
  }
}

// Run if called directly
main();

export { updateReadme };
