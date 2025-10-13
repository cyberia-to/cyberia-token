import { ethers } from "hardhat";

async function main() {
	// Use deployed Sepolia contract address
	const contractAddress = process.env.CAP_TOKEN_ADDRESS || "0xA419fD4e3BA375250d5D946D91262769F905aEED";

	console.log("🧪 Testing deployed CAP Token functionality on Sepolia...\n");
	console.log(`📍 Contract Address: ${contractAddress}\n`);

	// Get signer (only one available on Sepolia)
	const [signer] = await ethers.getSigners();
	console.log(`🔑 Your Address: ${signer.address}\n`);

	// Connect to deployed contract
	const cap = await ethers.getContractAt("CAPToken", contractAddress);

	// Test basic info
	console.log("📋 Basic Contract Info:");
	console.log("Name:", await cap.name());
	console.log("Symbol:", await cap.symbol());
	console.log("Total Supply:", ethers.formatEther(await cap.totalSupply()), "CAP");
	console.log("Owner:", await cap.owner());
	console.log("Fee Recipient:", await cap.feeRecipient());
	console.log("Paused:", await cap.paused());
	console.log();

	// Test tax rates
	console.log("💰 Tax Configuration:");
	console.log("Transfer Tax:", Number(await cap.transferTaxBp()) / 100, "%");
	console.log("Sell Tax:", Number(await cap.sellTaxBp()) / 100, "%");
	console.log("Buy Tax:", Number(await cap.buyTaxBp()) / 100, "%");
	console.log();

	// Test balances
	console.log("💳 Your Balance:");
	console.log("Balance:", ethers.formatEther(await cap.balanceOf(signer.address)), "CAP");
	console.log();

	// Check if you're the owner
	const owner = await cap.owner();
	const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
	console.log(`📋 Ownership Status: ${isOwner ? '✅ You are the owner' : '⚠️  You are not the owner'}`);
	console.log();

	// Create a test recipient (random address for demonstration)
	const testRecipient = ethers.Wallet.createRandom().address;
	console.log(`🎯 Test Recipient: ${testRecipient}\n`);

	// Test small transfer (read-only simulation)
	console.log("🔄 Testing Transfer Calculation...");
	const transferAmount = ethers.parseEther("100"); // 100 CAP
	const expectedTax = transferAmount * 100n / 10000n; // 1% tax
	const expectedReceived = transferAmount - expectedTax;
	console.log(`Amount to send: ${ethers.formatEther(transferAmount)} CAP`);
	console.log(`Expected tax: ${ethers.formatEther(expectedTax)} CAP (1%)`);
	console.log(`Expected received: ${ethers.formatEther(expectedReceived)} CAP`);
	console.log();

	// Test governance delegation
	console.log("🗝️  Testing Governance Features...");
	const currentVotes = await cap.getVotes(signer.address);
	console.log(`Current voting power: ${ethers.formatEther(currentVotes)} votes`);
	
	// Check if already delegated
	const delegate = await cap.delegates(signer.address);
	console.log(`Currently delegated to: ${delegate}`);
	console.log();

	// Test admin functions availability (read-only)
	console.log("⚙️ Admin Functions Status:");
	if (isOwner) {
		console.log("✅ You can call admin functions (setTaxes, addPool, etc.)");
		console.log("✅ You can pause/unpause the contract");
		console.log("✅ You can update fee recipient");
	} else {
		console.log("⚠️  You cannot call admin functions");
	}
	console.log();

	// Test governance features
	console.log("🏦 Governance Features:");
	try {
		// Check if permit is supported
		const domain = await cap.DOMAIN_SEPARATOR();
		console.log("✅ EIP-2612 Permit supported");
		console.log(`Domain separator: ${domain.substring(0, 10)}...`);
	} catch (e) {
		console.log("⚠️  Permit not supported");
	}
	console.log();

	// Network info
	console.log("🌍 Network Information:");
	const network = await signer.provider?.getNetwork();
	const blockNumber = await signer.provider?.getBlockNumber();
	console.log(`Network: ${network?.name || 'Unknown'} (Chain ID: ${network?.chainId})`);
	console.log(`Current Block: ${blockNumber}`);
	console.log();

	console.log("🎉 Contract inspection completed successfully!");
	console.log("✅ Contract is deployed and accessible on Sepolia!");
	console.log();
	console.log("🔗 View on Etherscan:");
	console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);
}

main().catch((error) => {
	console.error("❌ Test failed:", error);
	process.exitCode = 1;
});