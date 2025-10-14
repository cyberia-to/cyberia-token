export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  isTestnet: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl: string;
  confirmations: number;
  gasMultiplier?: number;
}

export interface DeploymentConfig {
  owner: string;
  feeRecipient: string;
  taxes?: {
    transfer: number;
    sell: number;
    buy: number;
  };
  poolAddresses?: string[];
}

export const NETWORKS: Record<string, NetworkConfig> = {
  localhost: {
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    isTestnet: true,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    explorerUrl: "",
    confirmations: 1,
  },
  sepolia: {
    name: "Sepolia Testnet",
    rpcUrl: process.env.SEPOLIA_RPC_URL || "",
    chainId: 11155111,
    isTestnet: true,
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    explorerUrl: "https://sepolia.etherscan.io",
    confirmations: 2,
  },
  mainnet: {
    name: "Ethereum Mainnet",
    rpcUrl: process.env.MAINNET_RPC_URL || "",
    chainId: 1,
    isTestnet: false,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    explorerUrl: "https://etherscan.io",
    confirmations: 5,
    gasMultiplier: 1.1, // 10% buffer for mainnet
  },
};

export function getNetworkConfig(networkName: string): NetworkConfig {
  const config = NETWORKS[networkName];
  if (!config) {
    throw new Error(`Unknown network: ${networkName}. Supported: ${Object.keys(NETWORKS).join(", ")}`);
  }
  return config;
}

export function getDeploymentConfig(networkName: string): DeploymentConfig {
  const envPrefix = networkName.toUpperCase();

  // For localhost, use default test values
  if (networkName === "localhost") {
    return {
      owner: process.env.LOCALHOST_OWNER_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Hardhat account #0
      feeRecipient: process.env.LOCALHOST_FEE_RECIPIENT || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Default Hardhat account #1
    };
  }

  // For testnets and mainnet, require explicit configuration
  const owner = process.env[`${envPrefix}_OWNER_ADDRESS`] || process.env.OWNER_ADDRESS;
  const feeRecipient = process.env[`${envPrefix}_FEE_RECIPIENT`] || process.env.FEE_RECIPIENT;

  if (!owner) {
    throw new Error(
      `Owner address not configured for ${networkName}. Set ${envPrefix}_OWNER_ADDRESS or OWNER_ADDRESS in .env`
    );
  }

  if (feeRecipient === undefined) {
    throw new Error(
      `Fee recipient not configured for ${networkName}. Set ${envPrefix}_FEE_RECIPIENT or FEE_RECIPIENT in .env`
    );
  }

  return {
    owner,
    feeRecipient,
  };
}

export function validateEnvironment(networkName: string): void {
  const config = getNetworkConfig(networkName);

  if (networkName !== "localhost" && !config.rpcUrl) {
    throw new Error(`RPC URL not configured for ${networkName}. Set ${networkName.toUpperCase()}_RPC_URL in .env`);
  }

  if (networkName === "mainnet") {
    console.warn("\n⚠️  WARNING: Deploying to MAINNET ⚠️");
    console.warn("This will use real ETH and deploy to production.");
    console.warn("Please ensure you have reviewed all configurations carefully.\n");
  }
}
