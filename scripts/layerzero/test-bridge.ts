import { ethers } from "hardhat";
import { Options } from "@layerzerolabs/lz-v2-utilities";

/**
 * Test Bridge Script
 *
 * Tests bridging CAP tokens from Sepolia to Arbitrum Sepolia
 * This script demonstrates the complete bridge flow including:
 * - Approving the adapter
 * - Estimating LayerZero fees
 * - Sending tokens cross-chain
 * - Verifying 1% tax is applied
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🧪 Testing LayerZero OFT Bridge");
  console.log("==================================================\n");
  console.log("Network:", network.name);
  console.log("Tester:", deployer.address);

  // Configuration - loaded from .env
  const CAP_TOKEN_ADDRESS = process.env.SEPOLIA_CAP_TOKEN_ADDRESS || "0xA6B680A88c16056de7194CF775D04A45D0692C11";
  const OFT_ADAPTER_ADDRESS = process.env.SEPOLIA_OFT_ADAPTER_ADDRESS || "";
  const ARBITRUM_SEPOLIA_EID = 40231; // LayerZero V2 Endpoint ID for Arbitrum Sepolia

  if (!OFT_ADAPTER_ADDRESS) {
    throw new Error("Please set SEPOLIA_OFT_ADAPTER_ADDRESS in .env");
  }

  console.log("Using CAP Token:", CAP_TOKEN_ADDRESS);
  console.log("Using OFT Adapter:", OFT_ADAPTER_ADDRESS);

  // Get contract instances
  const capToken = await ethers.getContractAt("CAPToken", CAP_TOKEN_ADDRESS);
  const oftAdapter = await ethers.getContractAt("CAPTokenOFTAdapter", OFT_ADAPTER_ADDRESS);

  // Test amount: 100 CAP tokens
  const testAmount = ethers.parseEther("100");

  console.log("\n📋 Test Configuration");
  console.log("==================================================");
  console.log("CAP Token:", CAP_TOKEN_ADDRESS);
  console.log("OFT Adapter:", OFT_ADAPTER_ADDRESS);
  console.log("Destination Chain: Arbitrum Sepolia (EID:", ARBITRUM_SEPOLIA_EID, ")");
  console.log("Test Amount:", ethers.formatEther(testAmount), "CAP");

  // Check balances
  const balance = await capToken.balanceOf(deployer.address);
  console.log("\n💰 Current Balance:", ethers.formatEther(balance), "CAP");

  if (balance < testAmount) {
    throw new Error(
      `Insufficient balance. You have ${ethers.formatEther(balance)} CAP but need ${ethers.formatEther(testAmount)} CAP`
    );
  }

  // Check if adapter is a pool (it shouldn't be)
  const isPool = await capToken.isPool(OFT_ADAPTER_ADDRESS);
  console.log("\n🔍 Adapter Pool Status:", isPool ? "❌ IS POOL (2% tax)" : "✅ NOT POOL (1% tax)");

  // Step 1: Approve adapter
  console.log("\n📝 Step 1: Approving OFT Adapter");
  console.log("==================================================");

  const currentAllowance = await capToken.allowance(deployer.address, OFT_ADAPTER_ADDRESS);

  if (currentAllowance < testAmount) {
    console.log("Approving", ethers.formatEther(testAmount), "CAP...");
    const approveTx = await capToken.approve(OFT_ADAPTER_ADDRESS, testAmount);
    await approveTx.wait();
    console.log("✅ Approved!");
  } else {
    console.log("✅ Already approved");
  }

  // Step 2: Calculate expected tax
  console.log("\n💸 Step 2: Tax Calculation");
  console.log("==================================================");

  const transferTaxBp = await capToken.transferTaxBp();
  const expectedTax = (testAmount * transferTaxBp) / 10000n;
  const expectedLocked = testAmount - expectedTax;

  console.log("Transfer Tax Rate:", Number(transferTaxBp) / 100, "%");
  console.log("Amount to bridge:", ethers.formatEther(testAmount), "CAP");
  console.log("Expected tax:", ethers.formatEther(expectedTax), "CAP");
  console.log("Expected locked in adapter:", ethers.formatEther(expectedLocked), "CAP");
  console.log("Expected to receive on Arbitrum:", ethers.formatEther(expectedLocked), "CAP");

  // Step 3: Quote LayerZero fee
  console.log("\n⛽ Step 3: Estimating LayerZero Fee");
  console.log("==================================================");

  // Create send parameters
  const options = Options.newOptions()
    .addExecutorLzReceiveOption(200000, 0) // 200k gas for receive
    .toHex();

  const sendParam = {
    dstEid: ARBITRUM_SEPOLIA_EID,
    to: ethers.zeroPadValue(deployer.address, 32), // recipient on destination chain
    amountLD: testAmount,
    minAmountLD: expectedLocked, // minimum to receive after tax
    extraOptions: options,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  const [nativeFee] = await oftAdapter.quoteSend(sendParam, false);
  console.log("LayerZero Fee:", ethers.formatEther(nativeFee), "ETH");

  // Check ETH balance for gas
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Your ETH Balance:", ethers.formatEther(ethBalance), "ETH");

  if (ethBalance < nativeFee) {
    throw new Error(`Insufficient ETH for LayerZero fee. Need ${ethers.formatEther(nativeFee)} ETH`);
  }

  // Step 4: Send tokens
  console.log("\n🚀 Step 4: Sending Tokens Cross-Chain");
  console.log("==================================================");

  const balanceBefore = await capToken.balanceOf(deployer.address);
  const adapterBalanceBefore = await capToken.balanceOf(OFT_ADAPTER_ADDRESS);

  console.log("Sending", ethers.formatEther(testAmount), "CAP to Arbitrum Sepolia...");
  console.log("\n⏳ Broadcasting transaction...");

  const sendTx = await oftAdapter.send(
    sendParam,
    { nativeFee, lzTokenFee: 0 },
    deployer.address, // refund address
    { value: nativeFee }
  );

  console.log("TX Hash:", sendTx.hash);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await sendTx.wait();
  console.log("✅ Transaction confirmed!");
  console.log("Gas used:", receipt.gasUsed.toString());

  // Step 5: Verify results
  console.log("\n✅ Step 5: Verifying Results");
  console.log("==================================================");

  const balanceAfter = await capToken.balanceOf(deployer.address);
  const adapterBalanceAfter = await capToken.balanceOf(OFT_ADAPTER_ADDRESS);

  const actualDeducted = balanceBefore - balanceAfter;
  const actualLocked = adapterBalanceAfter - adapterBalanceBefore;
  const actualTax = actualDeducted - actualLocked;

  console.log("\n📊 Results:");
  console.log("Amount deducted from sender:", ethers.formatEther(actualDeducted), "CAP");
  console.log("Amount locked in adapter:", ethers.formatEther(actualLocked), "CAP");
  console.log("Tax collected:", ethers.formatEther(actualTax), "CAP");
  console.log("Tax rate:", Number((actualTax * 10000n) / actualDeducted) / 100, "%");

  // Compare with expected
  console.log("\n🔍 Comparison:");
  console.log("Expected tax:", ethers.formatEther(expectedTax), "CAP");
  console.log("Actual tax:", ethers.formatEther(actualTax), "CAP");
  console.log("Match:", expectedTax === actualTax ? "✅ YES" : "❌ NO");

  console.log("\n📝 Next Steps:");
  console.log("1. Wait 1-2 minutes for LayerZero message delivery");
  console.log("2. Check Arbitrum Sepolia for received tokens");
  console.log("3. Verify you received:", ethers.formatEther(actualLocked), "CAP on Arbitrum");
  console.log("\nArbitrum Sepolia Explorer:");
  console.log(`https://sepolia.arbiscan.io/address/${deployer.address}`);

  console.log("\n==================================================");
  console.log("🎉 Bridge Test Complete!");
  console.log("==================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
