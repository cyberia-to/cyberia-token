import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-abi-exporter";
import "solidity-docgen";
import { HardhatUserConfig } from "hardhat/config";

// Load environment variables
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

// Gas reporter configuration
const REPORT_GAS = process.env.REPORT_GAS === "true";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// Default Hardhat test accounts (for localhost development) - currently unused
// Keeping for potential future use with custom account configuration

const _DEFAULT_HARDHAT_ACCOUNTS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Account #0 (Deployer)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Account #1
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Account #2
];

/**
 * Hardhat Configuration for Cyberia (CAP) Token
 *
 * Supports three environments:
 * 1. localhost - Local Hardhat network for development/testing
 * 2. sepolia - Ethereum Sepolia testnet
 * 3. mainnet - Ethereum mainnet (production)
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Optimized for deployment cost vs. runtime cost balance
      },
      evmVersion: "paris", // Compatible with Ethereum mainnet post-merge
    },
  },

  networks: {
    // Hardhat default network (in-process)
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        count: 20,
        accountsBalance: "10000000000000000000000", // 10,000 ETH
      },
      mining: {
        auto: true,
        interval: 0,
      },
    },

    // Localhost network (for external Hardhat node: npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Use "remote" to connect to the running node's accounts
      timeout: 60000, // 60 seconds
    },

    // Sepolia testnet
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: PRIVATE_KEY && PRIVATE_KEY.length === 66 ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000, // 2 minutes
    },

    // Ethereum mainnet (PRODUCTION)
    mainnet: {
      url: MAINNET_RPC_URL,
      chainId: 1,
      accounts: PRIVATE_KEY && PRIVATE_KEY.length === 66 ? [PRIVATE_KEY] : [],
      gasPrice: "auto", // Let ethers.js determine optimal gas price
      timeout: 180000, // 3 minutes
    },
  },

  // Etherscan verification
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      mainnet: ETHERSCAN_API_KEY,
    },
  },

  // Gas reporter (useful for optimization)
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: true,
  },

  // TypeChain configuration
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },

  // Path configurations
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Mocha test configuration
  mocha: {
    timeout: 120000, // 2 minutes for tests
  },

  // Contract size configuration
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    only: [],
  },

  // ABI Exporter configuration
  abiExporter: {
    path: "./abis",
    runOnCompile: false,
    clear: true,
    flat: true,
    only: [":CAPToken$"],
    spacing: 2,
    format: "json",
  },

  // Documentation generation
  docgen: {
    outputDir: "./docs/api",
    pages: "single",
    exclude: ["test", "OFTAdapterStub"],
    theme: "markdown",
  },
};

export default config;
