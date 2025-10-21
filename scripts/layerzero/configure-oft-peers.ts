import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

/**
 * Configure OFT Peer Connections
 *
 * This script configures the peer connections between the OFTAdapter on Ethereum
 * and the OFT contracts on destination chains.
 *
 * LayerZero requires bidirectional peer configuration:
 * 1. OFTAdapter on Ethereum must trust OFT on destination chain
 * 2. OFT on destination chain must trust OFTAdapter on Ethereum
 *
 * LayerZero V2 Endpoint IDs (EIDs):
 * - Ethereum: 30101
 * - Arbitrum: 30110
 * - Optimism: 30111
 * - Base: 30184
 * - Polygon: 30109
 *
 * Testnet EIDs:
 * - Sepolia: 40161
 * - Arbitrum Sepolia: 40231
 * - Optimism Sepolia: 40232
 * - Base Sepolia: 40245
 * - Polygon Amoy: 40267
 */

interface PeerConfig {
  chainName: string;
  eid: number;
  oftAddress: string;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🔗 Configuring OFT Peer Connections");
  console.log("==================================================\n");
  console.log("Signer address:", signer.address);
  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);

  // Configuration: Update these with your deployed addresses
  const config: {
    ethereum: { adapter: string };
    peers: PeerConfig[];
  } = {
    // OFTAdapter on Ethereum
    ethereum: {
      adapter:
        network.chainId === 11155111n
          ? process.env.SEPOLIA_OFT_ADAPTER_ADDRESS || process.env.OFT_ADAPTER_ADDRESS || ""
          : process.env.OFT_ADAPTER_ADDRESS || "",
    },
    // OFT contracts on destination chains
    peers: [
      {
        chainName: "Arbitrum",
        eid: 30110, // Arbitrum mainnet EID
        oftAddress: process.env.ARBITRUM_OFT_ADDRESS || "",
      },
      {
        chainName: "Optimism",
        eid: 30111, // Optimism mainnet EID
        oftAddress: process.env.OPTIMISM_OFT_ADDRESS || "",
      },
      {
        chainName: "Base",
        eid: 30184, // Base mainnet EID
        oftAddress: process.env.BASE_OFT_ADDRESS || "",
      },
      {
        chainName: "Polygon",
        eid: 30109, // Polygon mainnet EID
        oftAddress: process.env.POLYGON_OFT_ADDRESS || "",
      },
    ],
  };

  // For testnet, use testnet EIDs
  if (network.chainId === 11155111n) {
    // Sepolia
    config.peers = [
      {
        chainName: "Arbitrum Sepolia",
        eid: 40231,
        oftAddress: process.env.ARBITRUM_SEPOLIA_OFT_ADDRESS || "",
      },
      {
        chainName: "Optimism Sepolia",
        eid: 40232,
        oftAddress: process.env.OPTIMISM_SEPOLIA_OFT_ADDRESS || "",
      },
      {
        chainName: "Base Sepolia",
        eid: 40245,
        oftAddress: process.env.BASE_SEPOLIA_OFT_ADDRESS || "",
      },
    ];
  }

  // Determine if we're configuring from Ethereum or destination chain
  const isEthereum = network.chainId === 1n || network.chainId === 11155111n;

  if (isEthereum) {
    // Configure OFTAdapter on Ethereum to trust destination OFTs
    await configureAdapterPeers(config);
  } else {
    // Configure OFT on destination chain to trust Ethereum OFTAdapter
    await configureOFTPeer(config);
  }

  console.log("\n✅ Peer configuration completed!");
}

async function configureAdapterPeers(config: { ethereum: { adapter: string }; peers: PeerConfig[] }) {
  let adapterAddress = config.ethereum.adapter;

  // If not set in config, try network-specific env vars
  if (!adapterAddress || adapterAddress === "") {
    adapterAddress = process.env.SEPOLIA_OFT_ADAPTER_ADDRESS || process.env.OFT_ADAPTER_ADDRESS || "";
  }

  if (!adapterAddress || adapterAddress === "") {
    throw new Error(
      "OFT Adapter address not configured. Set SEPOLIA_OFT_ADAPTER_ADDRESS or OFT_ADAPTER_ADDRESS in .env"
    );
  }

  console.log("\n📝 Configuring OFTAdapter at:", adapterAddress);

  const adapter = await ethers.getContractAt("CAPTokenOFTAdapter", adapterAddress);

  for (const peer of config.peers) {
    if (!peer.oftAddress || peer.oftAddress === "") {
      console.log(`⚠️  Skipping ${peer.chainName} - OFT address not configured`);
      continue;
    }

    console.log(`\n🔗 Setting peer for ${peer.chainName}:`);
    console.log(`  - EID: ${peer.eid}`);
    console.log(`  - OFT Address: ${peer.oftAddress}`);

    // Convert address to bytes32 format (pad with zeros)
    const peerBytes32 = ethers.zeroPadValue(peer.oftAddress, 32);

    try {
      const tx = await adapter.setPeer(peer.eid, peerBytes32);
      console.log(`  - Transaction: ${tx.hash}`);

      await tx.wait();
      console.log(`  ✅ Peer configured successfully`);
    } catch (error) {
      console.error(`  ❌ Failed to set peer:`, error);
    }
  }
}

async function configureOFTPeer(config: { ethereum: { adapter: string }; peers: PeerConfig[] }) {
  // Get current network's OFT address from environment
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Determine which OFT address to use based on current network
  const oftAddressKey =
    chainId === 42161n
      ? "ARBITRUM_OFT_ADDRESS"
      : chainId === 421614n
        ? "ARBITRUM_SEPOLIA_OFT_ADDRESS"
        : chainId === 10n
          ? "OPTIMISM_OFT_ADDRESS"
          : chainId === 11155420n
            ? "OPTIMISM_SEPOLIA_OFT_ADDRESS"
            : chainId === 8453n
              ? "BASE_OFT_ADDRESS"
              : chainId === 84532n
                ? "BASE_SEPOLIA_OFT_ADDRESS"
                : chainId === 137n
                  ? "POLYGON_OFT_ADDRESS"
                  : chainId === 80002n
                    ? "POLYGON_AMOY_OFT_ADDRESS"
                    : "";

  if (!oftAddressKey) {
    throw new Error(`Unsupported network for OFT configuration: ${network.name}`);
  }

  const oftAddress = process.env[oftAddressKey] || "";

  if (!oftAddress || oftAddress === "") {
    throw new Error(`OFT address not configured. Set ${oftAddressKey} in .env`);
  }

  let adapterAddress = config.ethereum.adapter;

  // If not set in config, try network-specific env vars
  if (!adapterAddress || adapterAddress === "") {
    adapterAddress = process.env.SEPOLIA_OFT_ADAPTER_ADDRESS || process.env.OFT_ADAPTER_ADDRESS || "";
  }

  if (!adapterAddress || adapterAddress === "") {
    throw new Error(
      "OFT Adapter address not configured. Set SEPOLIA_OFT_ADAPTER_ADDRESS or OFT_ADAPTER_ADDRESS in .env"
    );
  }

  console.log("\n📝 Configuring OFT at:", oftAddress);
  console.log("To trust Ethereum OFTAdapter at:", adapterAddress);

  const oft = await ethers.getContractAt("CAPTokenOFT", oftAddress);

  // Determine Ethereum EID based on network (testnet vs mainnet)
  const isTestnet =
    chainId === 421614n || // Arbitrum Sepolia
    chainId === 11155420n || // Optimism Sepolia
    chainId === 84532n || // Base Sepolia
    chainId === 80002n; // Polygon Amoy

  const ethereumEid = isTestnet ? 40161 : 30101; // Sepolia or Mainnet

  // Convert adapter address to bytes32 format
  const peerBytes32 = ethers.zeroPadValue(adapterAddress, 32);

  console.log(`\n🔗 Setting peer for Ethereum:`);
  console.log(`  - EID: ${ethereumEid}`);
  console.log(`  - Adapter Address: ${adapterAddress}`);

  try {
    const tx = await oft.setPeer(ethereumEid, peerBytes32);
    console.log(`  - Transaction: ${tx.hash}`);

    await tx.wait();
    console.log(`  ✅ Peer configured successfully`);
  } catch (error) {
    console.error(`  ❌ Failed to set peer:`, error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
