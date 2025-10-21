import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

/**
 * Check OFT Peer Configurations
 *
 * This script checks which peers are configured on OFT/OFTAdapter contracts
 * Use this to verify peer connections and detect stale configurations
 */

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🔍 Checking OFT Peer Configurations");
  console.log("==================================================\n");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Signer:", signer.address);

  const chainId = network.chainId;

  // Determine which contract to check based on network
  const isEthereum = chainId === 1n || chainId === 11155111n;

  if (isEthereum) {
    // Check OFTAdapter on Ethereum/Sepolia
    await checkAdapterPeers();
  } else {
    // Check OFT on destination chain
    await checkOFTPeers();
  }

  console.log("\n==================================================\n");
}

async function checkAdapterPeers() {
  const network = await ethers.provider.getNetwork();
  const adapterAddress =
    network.chainId === 11155111n ? process.env.SEPOLIA_OFT_ADAPTER_ADDRESS : process.env.OFT_ADAPTER_ADDRESS;

  if (!adapterAddress) {
    throw new Error("OFT Adapter address not configured");
  }

  console.log("\n📝 OFTAdapter:", adapterAddress);

  const adapter = await ethers.getContractAt("CAPTokenOFTAdapter", adapterAddress);

  // Check peers for each destination chain
  const peersToCheck =
    network.chainId === 11155111n
      ? [
          { name: "Arbitrum Sepolia", eid: 40231 },
          { name: "Optimism Sepolia", eid: 40232 },
          { name: "Base Sepolia", eid: 40245 },
        ]
      : [
          { name: "Arbitrum", eid: 30110 },
          { name: "Optimism", eid: 30111 },
          { name: "Base", eid: 30184 },
          { name: "Polygon", eid: 30109 },
        ];

  console.log("\n🔗 Configured Peers:");
  console.log("==================================================");

  for (const peer of peersToCheck) {
    try {
      const peerAddress = await adapter.peers(peer.eid);

      if (peerAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`❌ ${peer.name} (EID ${peer.eid}): NOT CONFIGURED`);
      } else {
        // Convert bytes32 to address (take last 20 bytes)
        const addressHex = "0x" + peerAddress.slice(-40);
        console.log(`✅ ${peer.name} (EID ${peer.eid}): ${addressHex}`);
      }
    } catch {
      console.log(`⚠️  ${peer.name} (EID ${peer.eid}): Error reading peer`);
    }
  }
}

async function checkOFTPeers() {
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Get OFT address based on network
  let oftAddress = "";
  if (chainId === 421614n) oftAddress = process.env.ARBITRUM_SEPOLIA_OFT_ADDRESS || "";
  else if (chainId === 42161n) oftAddress = process.env.ARBITRUM_OFT_ADDRESS || "";
  else if (chainId === 11155420n) oftAddress = process.env.OPTIMISM_SEPOLIA_OFT_ADDRESS || "";
  else if (chainId === 10n) oftAddress = process.env.OPTIMISM_OFT_ADDRESS || "";
  else if (chainId === 84532n) oftAddress = process.env.BASE_SEPOLIA_OFT_ADDRESS || "";
  else if (chainId === 8453n) oftAddress = process.env.BASE_OFT_ADDRESS || "";
  else if (chainId === 80002n) oftAddress = process.env.POLYGON_AMOY_OFT_ADDRESS || "";
  else if (chainId === 137n) oftAddress = process.env.POLYGON_OFT_ADDRESS || "";

  if (!oftAddress) {
    throw new Error("OFT address not configured for this network");
  }

  console.log("\n📝 OFT:", oftAddress);

  const oft = await ethers.getContractAt("CAPTokenOFT", oftAddress);

  // Determine if testnet or mainnet
  const isTestnet =
    chainId === 421614n || // Arbitrum Sepolia
    chainId === 11155420n || // Optimism Sepolia
    chainId === 84532n || // Base Sepolia
    chainId === 80002n; // Polygon Amoy

  // Check peers for Ethereum (both mainnet and testnet EIDs to detect wrong config)
  const peersToCheck = [
    { name: "Ethereum Sepolia", eid: 40161, expected: isTestnet },
    { name: "Ethereum Mainnet", eid: 30101, expected: !isTestnet },
  ];

  console.log("\n🔗 Configured Peers:");
  console.log("==================================================");

  for (const peer of peersToCheck) {
    try {
      const peerAddress = await oft.peers(peer.eid);

      if (peerAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        if (peer.expected) {
          console.log(`❌ ${peer.name} (EID ${peer.eid}): NOT CONFIGURED (SHOULD BE)`);
        } else {
          console.log(`✅ ${peer.name} (EID ${peer.eid}): Not configured (correct)`);
        }
      } else {
        const addressHex = "0x" + peerAddress.slice(-40);
        if (peer.expected) {
          console.log(`✅ ${peer.name} (EID ${peer.eid}): ${addressHex} (CORRECT)`);
        } else {
          console.log(`⚠️  ${peer.name} (EID ${peer.eid}): ${addressHex} (STALE/WRONG!)`);
        }
      }
    } catch {
      console.log(`⚠️  ${peer.name} (EID ${peer.eid}): Error reading peer`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
