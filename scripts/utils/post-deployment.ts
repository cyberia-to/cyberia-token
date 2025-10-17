import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { DeploymentRecord } from "./deployment-tracker";
import packageJson from "../../package.json";

interface UpdateTarget {
  file: string;
  description: string;
}

/**
 * Post-deployment automation script
 * Automatically updates all deployment-related files and documentation
 */

/**
 * Update .env file with deployed contract address
 */
function updateEnvFile(network: string, proxyAddress: string): void {
  const envPath = join(process.cwd(), ".env");
  let envContent = readFileSync(envPath, "utf8");

  // Update CAP_TOKEN_ADDRESS
  const tokenAddressRegex = /^CAP_TOKEN_ADDRESS=.*$/m;
  if (tokenAddressRegex.test(envContent)) {
    envContent = envContent.replace(tokenAddressRegex, `CAP_TOKEN_ADDRESS=${proxyAddress}`);
  } else {
    // Add if not exists
    if (!envContent.endsWith("\n")) {
      envContent += "\n";
    }
    envContent += `CAP_TOKEN_ADDRESS=${proxyAddress}\n`;
  }

  writeFileSync(envPath, envContent, "utf8");
  console.log(`  ✅ Updated .env: CAP_TOKEN_ADDRESS=${proxyAddress}`);
}

/**
 * Update README.md with deployment information
 */
function updateReadme(network: string, deployment: DeploymentRecord): void {
  const readmePath = join(process.cwd(), "README.md");
  let content = readFileSync(readmePath, "utf8");

  if (network === "sepolia") {
    // Update badge link in header
    const badgeRegex = /(https:\/\/sepolia\.etherscan\.io\/address\/)0x[a-fA-F0-9]{40}(\))/;
    if (badgeRegex.test(content)) {
      content = content.replace(badgeRegex, `$1${deployment.proxyAddress}$2`);
      console.log(`  ✅ Updated README.md: Sepolia badge link`);
    }

    // Update Sepolia deployment table (only Token Proxy and Implementation rows)
    const proxyRegex =
      /(\| \*\*Token Proxy\*\*\s+\| )`0x[a-fA-F0-9]{40}`(\s+\| \[Etherscan\]\(https:\/\/sepolia\.etherscan\.io\/address\/)0x[a-fA-F0-9]{40}(\).*\|)/;
    if (proxyRegex.test(content)) {
      content = content.replace(proxyRegex, `$1\`${deployment.proxyAddress}\`$2${deployment.proxyAddress}$3`);
      console.log(`  ✅ Updated README.md: Token Proxy address`);
    }

    const implRegex =
      /(\| \*\*Implementation\*\*\s+\| )`0x[a-fA-F0-9]{40}`(\s+\| \[Etherscan\]\(https:\/\/sepolia\.etherscan\.io\/address\/)0x[a-fA-F0-9]{40}(\).*\|)/;
    if (implRegex.test(content)) {
      content = content.replace(
        implRegex,
        `$1\`${deployment.implementationAddress}\`$2${deployment.implementationAddress}$3`
      );
      console.log(`  ✅ Updated README.md: Implementation address`);
    }

    // Update deployment status
    const version = packageJson.version;
    const statusRegex = /\*\*Version\*\*: v[\d.]+ \| \*\*Status\*\*: [^|]+ \| ([^\n]+)/;
    if (statusRegex.test(content)) {
      const verifiedStatus = deployment.verified ? "✅ Verified" : "⏳ Pending Verification";
      content = content.replace(statusRegex, `**Version**: v${version} | **Status**: ${verifiedStatus} | $1`);
      console.log(`  ✅ Updated README.md: Deployment status`);
    }
  } else if (network === "mainnet") {
    // Update Mainnet section
    const mainnetRegex = /(### Mainnet\n\n)Not deployed yet\. Production deployment requires security audit\./;
    if (mainnetRegex.test(content)) {
      const mainnetTable = `| Component             | Address                                      | Link                                                                                           |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Token Proxy**       | \`${deployment.proxyAddress}\` | [Etherscan](https://etherscan.io/address/${deployment.proxyAddress})   |
| **Implementation**    | \`${deployment.implementationAddress}\` | [Etherscan](https://etherscan.io/address/${deployment.implementationAddress})   |

**Version**: v${packageJson.version} | **Status**: ✅ Verified | **Deployed**: ${new Date(deployment.timestamp).toLocaleDateString()}`;

      content = content.replace(mainnetRegex, `$1${mainnetTable}`);
      console.log(`  ✅ Updated README.md: Mainnet deployment section`);
    }
  }

  writeFileSync(readmePath, content, "utf8");
}

/**
 * Update package.json scripts with deployed address
 */
function updatePackageJson(network: string, _proxyAddress: string): void {
  const packagePath = join(process.cwd(), "package.json");
  const packageData = JSON.parse(readFileSync(packagePath, "utf8"));

  // Add convenience script for interacting with deployed contract
  if (!packageData.scripts[`console:${network}`]) {
    packageData.scripts[`console:${network}`] = `hardhat console --network ${network}`;
    writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + "\n", "utf8");
    console.log(`  ✅ Updated package.json: Added console:${network} script`);
  }
}

/**
 * Generate deployment summary markdown file
 */
function generateDeploymentSummary(network: string, deployment: DeploymentRecord): void {
  const summaryPath = join(process.cwd(), `DEPLOYMENT_${network.toUpperCase()}.md`);

  const explorerUrl = network === "mainnet" ? "https://etherscan.io" : `https://${network}.etherscan.io`;

  const summary = `# ${network.charAt(0).toUpperCase() + network.slice(1)} Deployment Summary

**Deployed:** ${new Date(deployment.timestamp).toLocaleString()}
**Network:** ${network}
**Chain ID:** ${deployment.chainId}

## Contract Addresses

| Component | Address | Explorer |
|-----------|---------|----------|
| **Proxy** | \`${deployment.proxyAddress}\` | [View](${explorerUrl}/address/${deployment.proxyAddress}) |
| **Implementation** | \`${deployment.implementationAddress}\` | [View](${explorerUrl}/address/${deployment.implementationAddress}#code) |

## Deployment Details

- **Transaction Hash:** \`${deployment.txHash}\`
- **Block Number:** ${deployment.blockNumber}
- **Deployer:** \`${deployment.deployer}\`
- **Governance:** \`${deployment.owner}\`
- **Fee Recipient:** \`${deployment.feeRecipient}\`
- **Verified:** ${deployment.verified ? "✅ Yes" : "⏳ Pending"}

## Contract Configuration

- **Name:** Cyberia
- **Symbol:** CAP
- **Initial Supply:** 1,000,000,000 CAP
- **Max Supply:** 10,000,000,000 CAP

## Next Steps

### 1. Verify Contract (if not auto-verified)
\`\`\`bash
npm run verify:${network}
\`\`\`

### 2. Update Environment Variables
\`\`\`bash
# Add to .env
CAP_TOKEN_ADDRESS=${deployment.proxyAddress}
\`\`\`

### 3. Transfer Governance to DAO
\`\`\`javascript
const capToken = await ethers.getContractAt("CAPToken", "${deployment.proxyAddress}");
await capToken.setGovernance(ARAGON_DAO_ADDRESS);
\`\`\`

### 4. Configure AMM Pools
\`\`\`bash
npm run configure:${network}
\`\`\`

### 5. Setup Gnosis Safe + Zodiac
- Deploy Safe with board members
- Install Zodiac Roles module
- Import \`docs/zodiac-roles-config.json\`
- Set Safe as fee recipient

## Links

- **Explorer:** ${explorerUrl}/address/${deployment.proxyAddress}
- **Deployment Record:** \`deployments.json\`
- **Integration Guide:** \`docs/aragon-integration.md\`
- **Safe Setup:** \`docs/safe-setup-guide.md\`

---

*Generated automatically by post-deployment script on ${new Date().toLocaleString()}*
`;

  writeFileSync(summaryPath, summary, "utf8");
  console.log(`  ✅ Generated deployment summary: ${summaryPath}`);
}

/**
 * Main post-deployment update function
 */
export async function runPostDeploymentUpdates(network: string, deployment: DeploymentRecord): Promise<void> {
  console.log(`\n📝 Running post-deployment updates for ${network}...`);

  const updates: UpdateTarget[] = [
    { file: ".env", description: "Environment variables" },
    { file: "README.md", description: "Documentation" },
    { file: "package.json", description: "NPM scripts" },
    { file: `DEPLOYMENT_${network.toUpperCase()}.md`, description: "Deployment summary" },
  ];

  console.log(`\n📋 Files to update:`);
  updates.forEach((target) => console.log(`   - ${target.file}: ${target.description}`));
  console.log();

  try {
    // Update .env
    updateEnvFile(network, deployment.proxyAddress);

    // Update README.md
    updateReadme(network, deployment);

    // Update package.json
    updatePackageJson(network, deployment.proxyAddress);

    // Generate deployment summary
    generateDeploymentSummary(network, deployment);

    console.log(`\n✅ All post-deployment updates completed successfully!\n`);
  } catch (error) {
    console.error(`\n❌ Error during post-deployment updates:`, error);
    throw error;
  }
}

/**
 * Validate deployment consistency across all files
 */
export function validateDeploymentConsistency(network: string, expectedAddress: string): boolean {
  console.log(`\n🔍 Validating deployment consistency for ${network}...`);

  const issues: string[] = [];

  // Check .env
  try {
    const envContent = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = envContent.match(/^CAP_TOKEN_ADDRESS=(.*)$/m);
    if (match && match[1] !== expectedAddress) {
      issues.push(`.env: CAP_TOKEN_ADDRESS mismatch (${match[1]} vs ${expectedAddress})`);
    }
  } catch {
    issues.push(`.env: Could not read file`);
  }

  // Check README.md
  try {
    const readmeContent = readFileSync(join(process.cwd(), "README.md"), "utf8");
    if (!readmeContent.includes(expectedAddress)) {
      issues.push(`README.md: Address ${expectedAddress} not found`);
    }
  } catch {
    issues.push(`README.md: Could not read file`);
  }

  if (issues.length > 0) {
    console.log(`\n⚠️  Found ${issues.length} consistency issue(s):`);
    issues.forEach((issue) => console.log(`   - ${issue}`));
    return false;
  }

  console.log(`✅ All files are consistent with deployment address ${expectedAddress}\n`);
  return true;
}
