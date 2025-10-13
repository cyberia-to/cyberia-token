import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface DeploymentRecord {
  network: string;
  chainId: number;
  timestamp: string;
  proxyAddress: string;
  implementationAddress: string;
  deployer: string;
  owner: string;
  feeRecipient: string;
  txHash: string;
  blockNumber: number;
  verified: boolean;
}

export interface DeploymentsFile {
  version: string;
  deployments: Record<string, DeploymentRecord>;
}

const DEPLOYMENTS_FILE = join(process.cwd(), "deployments.json");

export function loadDeployments(): DeploymentsFile {
  if (!existsSync(DEPLOYMENTS_FILE)) {
    return {
      version: "1.0.0",
      deployments: {},
    };
  }

  try {
    const data = readFileSync(DEPLOYMENTS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.warn("Warning: Could not read deployments.json, starting fresh");
    return {
      version: "1.0.0",
      deployments: {},
    };
  }
}

export function saveDeployment(network: string, record: DeploymentRecord): void {
  const deployments = loadDeployments();
  deployments.deployments[network] = record;

  writeFileSync(
    DEPLOYMENTS_FILE,
    JSON.stringify(deployments, null, 2) + "\n",
    "utf8"
  );

  console.log(`\n✅ Deployment record saved to deployments.json`);
}

export function getDeployment(network: string): DeploymentRecord | null {
  const deployments = loadDeployments();
  return deployments.deployments[network] || null;
}

export function listDeployments(): void {
  const deployments = loadDeployments();
  const networks = Object.keys(deployments.deployments);

  if (networks.length === 0) {
    console.log("No deployments found.");
    return;
  }

  console.log("\n=== Deployment History ===\n");
  for (const network of networks) {
    const deployment = deployments.deployments[network];
    console.log(`${network.toUpperCase()}:`);
    console.log(`  Proxy: ${deployment.proxyAddress}`);
    console.log(`  Deployed: ${deployment.timestamp}`);
    console.log(`  Verified: ${deployment.verified ? "Yes" : "No"}`);
    console.log(`  Chain ID: ${deployment.chainId}`);
    console.log();
  }
}
