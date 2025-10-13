import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/config";

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const HOLESKY_RPC_URL = process.env.HOLESKY_RPC_URL || "";
const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

const config: HardhatUserConfig = {
	solidity: {
		version: "0.8.24",
		settings: {
			optimizer: { enabled: true, runs: 200 },
		},
	},
	networks: {
		localhost: {
			url: "http://127.0.0.1:8546",
			accounts: PRIVATE_KEY && PRIVATE_KEY.length === 66 ? [PRIVATE_KEY] : [
				"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" // Default hardhat account
			],
		},
		sepolia: {
			url: SEPOLIA_RPC_URL || undefined,
			accounts: PRIVATE_KEY && PRIVATE_KEY.length === 66 ? [PRIVATE_KEY] : [],
		},
		holesky: {
			url: HOLESKY_RPC_URL || undefined,
			accounts: PRIVATE_KEY && PRIVATE_KEY.length === 66 ? [PRIVATE_KEY] : [],
		},
		"arbitrum-sepolia": {
			url: ARBITRUM_SEPOLIA_RPC_URL || undefined,
			accounts: PRIVATE_KEY && PRIVATE_KEY.length === 66 ? [PRIVATE_KEY] : [],
		},
	},
	etherscan: {
		apiKey: {
			sepolia: ETHERSCAN_API_KEY || "",
			holesky: ETHERSCAN_API_KEY || "",
			arbitrumSepolia: ARBISCAN_API_KEY || "",
		},
		customChains: [
			{
				network: "arbitrumSepolia",
				chainId: 421614,
				urls: {
					apiURL: "https://api-sepolia.arbiscan.io/api",
					browserURL: "https://sepolia.arbiscan.io",
				},
			},
		],
	},
	typechain: {
		outDir: "typechain-types",
		target: "ethers-v6",
	},
};

export default config;

