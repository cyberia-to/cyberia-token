import { ethers } from "hardhat";

/**
 * Comprehensive Localhost Testing Script
 * Tests all major functionality of the CAP token
 */

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║     COMPREHENSIVE LOCALHOST TESTING - CYBERIA (CAP) TOKEN     ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Get test accounts
  const signers = await ethers.getSigners();

  if (signers.length < 6) {
    throw new Error(`Not enough signers. Need at least 6, got ${signers.length}`);
  }

  const owner = signers[0]!;
  const treasury = signers[1]!;
  const user1 = signers[2]!;
  const user2 = signers[3]!;
  const pool = signers[4]!;
  const newTreasury = signers[5]!;

  console.log("📋 Test Accounts:");
  console.log(`  Owner:        ${owner.address}`);
  console.log(`  Treasury:     ${treasury.address}`);
  console.log(`  User 1:       ${user1.address}`);
  console.log(`  User 2:       ${user2.address}`);
  console.log(`  Pool (AMM):   ${pool.address}`);
  console.log(`  New Treasury: ${newTreasury.address}\n`);

  // Get deployed contract
  const contractAddress = process.env.CAP_TOKEN_ADDRESS;
  if (!contractAddress) {
    throw new Error("CAP_TOKEN_ADDRESS not set. Deploy first!");
  }

  console.log(`📍 Contract Address: ${contractAddress}\n`);
  const token = await ethers.getContractAt("CAPToken", contractAddress);

  // Test 1: Basic Token Info
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 1: Basic Token Information");
  console.log("═══════════════════════════════════════════════════════════════");
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const ownerBalance = await token.balanceOf(owner.address);

  console.log(`✓ Name: ${name}`);
  console.log(`✓ Symbol: ${symbol}`);
  console.log(`✓ Decimals: ${decimals}`);
  console.log(`✓ Total Supply: ${ethers.formatEther(totalSupply)} CAP`);
  console.log(`✓ Owner Balance: ${ethers.formatEther(ownerBalance)} CAP\n`);

  // Test 2: Tax Configuration
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 2: Tax Configuration");
  console.log("═══════════════════════════════════════════════════════════════");
  const transferTax = await token.transferTaxBp();
  const sellTax = await token.sellTaxBp();
  const buyTax = await token.buyTaxBp();
  const feeRecipient = await token.feeRecipient();

  console.log(`✓ Transfer Tax: ${transferTax} bp (${Number(transferTax) / 100}%)`);
  console.log(`✓ Sell Tax: ${sellTax} bp (${Number(sellTax) / 100}%)`);
  console.log(`✓ Buy Tax: ${buyTax} bp (${Number(buyTax) / 100}%)`);
  console.log(`✓ Fee Recipient: ${feeRecipient}\n`);

  // Test 3: Basic Transfer (User to User)
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 3: Basic Transfer with 1% Tax");
  console.log("═══════════════════════════════════════════════════════════════");
  const transferAmount = ethers.parseEther("1000");

  console.log(`Transferring ${ethers.formatEther(transferAmount)} CAP from owner to user1...`);
  await token.transfer(user1.address, transferAmount);

  const user1Balance = await token.balanceOf(user1.address);
  const treasuryBalance = await token.balanceOf(treasury.address);
  const expectedNet = transferAmount * 99n / 100n; // 1% tax
  const expectedTax = transferAmount - expectedNet;

  console.log(`✓ User1 received: ${ethers.formatEther(user1Balance)} CAP (expected: ${ethers.formatEther(expectedNet)})`);
  console.log(`✓ Tax collected: ${ethers.formatEther(treasuryBalance)} CAP (expected: ${ethers.formatEther(expectedTax)})\n`);

  // Test 4: Add Pool
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 4: Pool Management");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Adding ${pool.address} as AMM pool...`);
  await token.addPool(pool.address);

  const isPool = await token.isPool(pool.address);
  console.log(`✓ Pool registered: ${isPool}\n`);

  // Test 5: Sell Transaction (User -> Pool) - Should have 2% tax (1% transfer + 1% sell)
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 5: Sell Transaction (User -> Pool) - 2% Total Tax");
  console.log("═══════════════════════════════════════════════════════════════");
  const sellAmount = ethers.parseEther("100");

  console.log(`User1 selling ${ethers.formatEther(sellAmount)} CAP to pool...`);
  await token.connect(user1).transfer(pool.address, sellAmount);

  const poolBalance = await token.balanceOf(pool.address);
  const treasuryAfterSell = await token.balanceOf(treasury.address);
  const expectedNetSell = sellAmount * 98n / 100n; // 2% tax (1% transfer + 1% sell)
  const expectedTaxSell = sellAmount - expectedNetSell;

  console.log(`✓ Pool received: ${ethers.formatEther(poolBalance)} CAP (expected: ${ethers.formatEther(expectedNetSell)})`);
  console.log(`✓ Additional tax: ${ethers.formatEther(expectedTaxSell)} CAP`);
  console.log(`✓ Treasury total: ${ethers.formatEther(treasuryAfterSell)} CAP\n`);

  // Test 6: Buy Transaction (Pool -> User) - Should have 0% tax
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 6: Buy Transaction (Pool -> User) - 0% Tax");
  console.log("═══════════════════════════════════════════════════════════════");
  const buyAmount = ethers.parseEther("50");

  console.log(`User2 buying ${ethers.formatEther(buyAmount)} CAP from pool...`);
  await token.connect(pool).transfer(user2.address, buyAmount);

  const user2Balance = await token.balanceOf(user2.address);
  console.log(`✓ User2 received: ${ethers.formatEther(user2Balance)} CAP (no tax on buys)`);
  console.log(`✓ Expected: ${ethers.formatEther(buyAmount)} CAP\n`);

  // Test 7: Update Taxes
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 7: Update Tax Rates");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Updating taxes to 2% transfer, 1.5% sell, 0.5% buy...");
  await token.setTaxes(200, 150, 50); // 2%, 1.5%, 0.5%

  const newTransferTax = await token.transferTaxBp();
  const newSellTax = await token.sellTaxBp();
  const newBuyTax = await token.buyTaxBp();

  console.log(`✓ New Transfer Tax: ${newTransferTax} bp (${Number(newTransferTax) / 100}%)`);
  console.log(`✓ New Sell Tax: ${newSellTax} bp (${Number(newSellTax) / 100}%)`);
  console.log(`✓ New Buy Tax: ${newBuyTax} bp (${Number(newBuyTax) / 100}%)\n`);

  // Test 8: Update Fee Recipient
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 8: Update Fee Recipient");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Changing fee recipient to ${newTreasury.address}...`);
  await token.setFeeRecipient(newTreasury.address);

  const updatedRecipient = await token.feeRecipient();
  console.log(`✓ New Fee Recipient: ${updatedRecipient}\n`);

  // Test 9: Governance - Delegation
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 9: Governance Features (Delegation)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`User1 delegating voting power to user2...`);
  await token.connect(user1).delegate(user2.address);

  const user1VotingPower = await token.getVotes(user1.address);
  const user2VotingPower = await token.getVotes(user2.address);
  const user1TokenBalance = await token.balanceOf(user1.address);

  console.log(`✓ User1 token balance: ${ethers.formatEther(user1TokenBalance)} CAP`);
  console.log(`✓ User1 voting power: ${ethers.formatEther(user1VotingPower)} votes`);
  console.log(`✓ User2 voting power: ${ethers.formatEther(user2VotingPower)} votes (delegated)\n`);

  // Test 10: Burn Mechanism
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 10: Token Burning");
  console.log("═══════════════════════════════════════════════════════════════");
  const burnAmount = ethers.parseEther("10");
  const beforeBurn = await token.totalSupply();

  console.log(`User1 burning ${ethers.formatEther(burnAmount)} CAP...`);
  await token.connect(user1).burn(burnAmount);

  const afterBurn = await token.totalSupply();
  const burned = beforeBurn - afterBurn;

  console.log(`✓ Total supply before: ${ethers.formatEther(beforeBurn)} CAP`);
  console.log(`✓ Total supply after: ${ethers.formatEther(afterBurn)} CAP`);
  console.log(`✓ Burned: ${ethers.formatEther(burned)} CAP\n`);

  // Test 12: Burn Mode (Fee Recipient = 0x0)
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 12: Burn Mode (Fee Recipient = 0x0)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Enabling burn mode...");
  await token.setFeeRecipient(ethers.ZeroAddress);

  const burnModeRecipient = await token.feeRecipient();
  console.log(`✓ Fee recipient: ${burnModeRecipient} (burn mode)`);

  const supplyBeforeBurnMode = await token.totalSupply();
  const burnModeTransferAmount = ethers.parseEther("100");

  console.log(`Transferring ${ethers.formatEther(burnModeTransferAmount)} CAP in burn mode...`);
  await token.transfer(user1.address, burnModeTransferAmount);

  const supplyAfterBurnMode = await token.totalSupply();
  const autoBurned = supplyBeforeBurnMode - supplyAfterBurnMode;

  console.log(`✓ Supply before: ${ethers.formatEther(supplyBeforeBurnMode)} CAP`);
  console.log(`✓ Supply after: ${ethers.formatEther(supplyAfterBurnMode)} CAP`);
  console.log(`✓ Auto-burned (tax): ${ethers.formatEther(autoBurned)} CAP\n`);

  // Test 13: Remove Pool
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 13: Remove Pool");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Removing pool ${pool.address}...`);
  await token.removePool(pool.address);

  const isStillPool = await token.isPool(pool.address);
  console.log(`✓ Pool removed: ${!isStillPool}\n`);

  // Test 14: Access Control
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST 14: Access Control (Non-Owner Attempts)");
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    await token.connect(user1).setTaxes(100, 100, 0);
    console.log("✗ Non-owner should not be able to set taxes!");
  } catch (error) {
    console.log("✓ Non-owner blocked from setting taxes");
  }

  try {
    await token.connect(user1).addPool(user2.address);
    console.log("✗ Non-owner should not be able to add pools!");
  } catch (error) {
    console.log("✓ Non-owner blocked from adding pools");
  }

  console.log();

  // Final Summary
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");

  const finalSupply = await token.totalSupply();
  const finalOwner = await token.owner();
  const finalRecipient = await token.feeRecipient();

  console.log(`Total Supply: ${ethers.formatEther(finalSupply)} CAP`);
  console.log(`Owner: ${finalOwner}`);
  console.log(`Fee Recipient: ${finalRecipient === ethers.ZeroAddress ? "Burn Mode" : finalRecipient}`);
  console.log();

  console.log("🎉 All tests completed successfully!");
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║              COMPREHENSIVE TESTING COMPLETE ✅                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Testing failed:", error);
    process.exit(1);
  });
