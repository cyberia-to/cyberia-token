// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CAPToken} from "../../contracts/CAPToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title CAPTokenStatefulTest
 * @notice Stateful fuzz testing for complex multi-step scenarios
 * @dev Tests sequences of operations that could expose edge cases
 */
contract CAPTokenStatefulTest is Test {
	CAPToken public token;
	CAPToken public implementation;
	address public owner;
	address public feeRecipient;

	// Test actors
	address public alice;
	address public bob;
	address public carol;
	address public pool1;
	address public pool2;

	// Constants
	uint256 constant BASIS_POINTS_DENOMINATOR = 10_000;
	uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;
	uint256 constant MAX_SUPPLY = 10_000_000_000 ether;

	function setUp() public {
		owner = address(this);
		feeRecipient = makeAddr("feeRecipient");
		alice = makeAddr("alice");
		bob = makeAddr("bob");
		carol = makeAddr("carol");
		pool1 = makeAddr("pool1");
		pool2 = makeAddr("pool2");

		// Deploy implementation
		implementation = new CAPToken();

		// Deploy proxy
		bytes memory initData = abi.encodeWithSelector(CAPToken.initialize.selector, owner, feeRecipient);
		ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

		// Wrap in ABI
		token = CAPToken(address(proxy));

		// Distribute initial tokens
		token.transfer(alice, INITIAL_SUPPLY / 10);
		token.transfer(bob, INITIAL_SUPPLY / 10);
		token.transfer(carol, INITIAL_SUPPLY / 10);
	}

	/*//////////////////////////////////////////////////////////////
                        MULTI-TRANSFER SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Multiple sequential transfers
	function testStateful_SequentialTransfers(uint8 numTransfers, uint256 baseAmount) public {
		vm.assume(numTransfers > 0 && numTransfers <= 20);
		vm.assume(baseAmount > 1000 && baseAmount <= token.balanceOf(alice) / numTransfers);

		uint256 initialBalance = token.balanceOf(alice);
		uint256 initialTreasury = token.balanceOf(feeRecipient);

		// Execute multiple transfers
		for (uint256 i = 0; i < numTransfers; i++) {
			vm.prank(alice);
			token.transfer(bob, baseAmount);
		}

		// Verify total transferred
		uint256 totalTransferred = baseAmount * numTransfers;
		uint256 expectedTax = (totalTransferred * 100) / BASIS_POINTS_DENOMINATOR; // 1%

		assertEq(token.balanceOf(alice), initialBalance - totalTransferred, "Alice balance incorrect");
		assertApproxEqAbs(token.balanceOf(feeRecipient) - initialTreasury, expectedTax, numTransfers, "Treasury didn't receive correct tax");
	}

	/// @notice Stateful test: Circular transfers
	function testStateful_CircularTransfers(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 10);

		uint256 initialAlice = token.balanceOf(alice);
		uint256 initialBob = token.balanceOf(bob);
		uint256 initialCarol = token.balanceOf(carol);

		// Alice -> Bob -> Carol -> Alice
		vm.prank(alice);
		token.transfer(bob, amount);

		uint256 bobReceived = token.balanceOf(bob) - initialBob;

		vm.prank(bob);
		token.transfer(carol, bobReceived);

		uint256 carolReceived = token.balanceOf(carol) - initialCarol;

		vm.prank(carol);
		token.transfer(alice, carolReceived);

		// Alice should have less than initial due to 3 rounds of tax
		assertLt(token.balanceOf(alice), initialAlice, "Circular transfer should reduce total due to tax");
	}

	/*//////////////////////////////////////////////////////////////
                        POOL INTERACTION SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Pool addition/removal with transfers
	function testStateful_PoolManagement(uint256 transferAmount) public {
		vm.assume(transferAmount > 1000 && transferAmount <= token.balanceOf(alice) / 4);

		// Add pool1
		token.addPool(pool1);

		uint256 treasuryBefore = token.balanceOf(feeRecipient);

		// Sell to pool (should have 2% tax)
		vm.prank(alice);
		token.transfer(pool1, transferAmount);

		uint256 sellTax = token.balanceOf(feeRecipient) - treasuryBefore;
		uint256 expectedSellTax = (transferAmount * 200) / BASIS_POINTS_DENOMINATOR; // 2%
		assertEq(sellTax, expectedSellTax, "Sell tax incorrect");

		// Remove pool1
		token.removePool(pool1);

		treasuryBefore = token.balanceOf(feeRecipient);

		// Transfer to former pool (should have 1% tax now)
		vm.prank(bob);
		token.transfer(pool1, transferAmount);

		uint256 regularTax = token.balanceOf(feeRecipient) - treasuryBefore;
		uint256 expectedRegularTax = (transferAmount * 100) / BASIS_POINTS_DENOMINATOR; // 1%
		assertEq(regularTax, expectedRegularTax, "Regular tax incorrect after pool removal");
	}

	/// @notice Stateful test: Multiple pool interactions
	function testStateful_MultiplePoolSwaps(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 10);

		token.addPool(pool1);
		token.addPool(pool2);

		// Give tokens to pools (owner pays 1% tax)
		token.transfer(pool1, amount * 3);
		token.transfer(pool2, amount * 3);

		uint256 initialAlice = token.balanceOf(alice);

		// Alice sells to pool1 (2% tax: 1% transfer + 1% sell)
		vm.prank(alice);
		token.transfer(pool1, amount);

		// Pool1 received (amount - 2% tax)
		uint256 pool1Received = (amount * (BASIS_POINTS_DENOMINATOR - 200)) / BASIS_POINTS_DENOMINATOR;

		// Pool1 transfers to pool2 (pool-to-pool, no tax)
		uint256 pool2BalanceBefore = token.balanceOf(pool2);
		vm.prank(pool1);
		token.transfer(pool2, pool1Received);

		assertEq(token.balanceOf(pool2) - pool2BalanceBefore, pool1Received, "Pool-to-pool transfer should have no tax");

		// Pool2 transfers back to alice (buy, 0% tax by default)
		vm.prank(pool2);
		token.transfer(alice, pool1Received);

		// Alice should have net loss of 2% of the amount she initially sent (allow for rounding)
		uint256 expectedLoss = (amount * 200) / BASIS_POINTS_DENOMINATOR;
		assertApproxEqAbs(initialAlice - token.balanceOf(alice), expectedLoss, 1, "Alice should have net loss equal to sell tax");
	}

	/*//////////////////////////////////////////////////////////////
                        BURN AND MINT SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Burn and mint cycle
	function testStateful_BurnMintCycle(uint256 burnAmount, uint256 mintAmount) public {
		vm.assume(burnAmount > 0 && burnAmount <= token.balanceOf(alice) / 2);
		vm.assume(mintAmount > 0 && mintAmount <= MAX_SUPPLY - token.totalSupply());

		uint256 initialSupply = token.totalSupply();

		// Burn
		vm.prank(alice);
		token.burn(burnAmount);

		assertEq(token.totalSupply(), initialSupply - burnAmount, "Supply should decrease by burn amount");

		// Mint
		token.mint(bob, mintAmount);

		assertEq(token.totalSupply(), initialSupply - burnAmount + mintAmount, "Supply should reflect burn and mint");
	}

	/// @notice Stateful test: Multiple burns from different users
	function testStateful_MultipleBurns(uint256 amount1, uint256 amount2, uint256 amount3) public {
		vm.assume(amount1 > 0 && amount1 <= token.balanceOf(alice));
		vm.assume(amount2 > 0 && amount2 <= token.balanceOf(bob));
		vm.assume(amount3 > 0 && amount3 <= token.balanceOf(carol));

		uint256 initialSupply = token.totalSupply();
		uint256 totalBurned = amount1 + amount2 + amount3;

		vm.prank(alice);
		token.burn(amount1);

		vm.prank(bob);
		token.burn(amount2);

		vm.prank(carol);
		token.burn(amount3);

		assertEq(token.totalSupply(), initialSupply - totalBurned, "Total burned amount should match supply decrease");
	}

	/*//////////////////////////////////////////////////////////////
                        DELEGATION SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Delegation chain with transfers
	function testStateful_DelegationWithTransfers(uint256 transferAmount) public {
		vm.assume(transferAmount > 0 && transferAmount <= token.balanceOf(alice) / 4);

		// Setup delegation: alice -> bob, bob -> carol, carol -> carol
		vm.prank(alice);
		token.delegate(bob);

		vm.prank(bob);
		token.delegate(carol);

		vm.prank(carol);
		token.delegate(carol);

		vm.roll(block.number + 1);

		// Carol should have voting power from bob's balance + own balance
		uint256 carolInitialVotes = token.getVotes(carol);
		uint256 expectedVotes = token.balanceOf(bob) + token.balanceOf(carol);
		assertEq(carolInitialVotes, expectedVotes, "Carol should have bob + carol voting power");

		// Alice transfers to bob
		vm.prank(alice);
		token.transfer(bob, transferAmount);

		vm.roll(block.number + 1);

		// Bob's balance increased, so carol's voting power should increase
		uint256 carolNewVotes = token.getVotes(carol);
		assertGt(carolNewVotes, carolInitialVotes, "Carol's voting power should increase after bob receives tokens");
	}

	/// @notice Stateful test: Delegation changes during transfers
	function testStateful_DelegationChanges(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 2);

		// Alice delegates to bob
		vm.prank(alice);
		token.delegate(bob);

		vm.roll(block.number + 1);

		uint256 bobInitialVotes = token.getVotes(bob);
		assertEq(bobInitialVotes, token.balanceOf(alice), "Bob should have alice's voting power");

		// Alice transfers half
		vm.prank(alice);
		token.transfer(carol, amount);

		vm.roll(block.number + 1);

		// Bob's voting power should decrease
		uint256 bobNewVotes = token.getVotes(bob);
		assertLt(bobNewVotes, bobInitialVotes, "Bob's voting power should decrease after alice transfers");

		// Alice changes delegation to carol
		vm.prank(alice);
		token.delegate(carol);

		vm.roll(block.number + 1);

		// Bob should have no voting power from alice now
		assertEq(token.getVotes(bob), 0, "Bob should have no voting power after delegation change");

		// Carol should have voting power from alice's remaining balance
		assertGt(token.getVotes(carol), 0, "Carol should have voting power from alice");
	}

	/*//////////////////////////////////////////////////////////////
                        TAX CHANGE SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Tax changes with ongoing transfers
	function testStateful_TaxChangeDuringTransfers(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 10);

		// Transfer with initial tax (1%)
		uint256 treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(alice);
		token.transfer(bob, amount);
		uint256 tax1 = token.balanceOf(feeRecipient) - treasuryBefore;

		// Change taxes
		token.setTaxesImmediate(200, 300, 50); // 2%, 3%, 0.5%

		// Transfer with new tax (2%)
		treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(bob);
		token.transfer(carol, amount);
		uint256 tax2 = token.balanceOf(feeRecipient) - treasuryBefore;

		// Second tax should be approximately 2x first tax (allow for rounding)
		assertApproxEqAbs(tax2, tax1 * 2, 1, "Tax should scale with new rate");
	}

	/*//////////////////////////////////////////////////////////////
                        ALLOWANCE SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Multiple transferFrom operations
	function testStateful_MultipleTransferFrom(uint256 allowanceAmount, uint8 numTransfers) public {
		vm.assume(numTransfers > 0 && numTransfers <= 10);
		vm.assume(allowanceAmount > numTransfers * 1000 && allowanceAmount <= token.balanceOf(alice));

		uint256 transferAmount = allowanceAmount / numTransfers;

		// Alice approves bob
		vm.prank(alice);
		token.approve(bob, allowanceAmount);

		uint256 initialAllowance = token.allowance(alice, bob);

		// Bob transfers from alice multiple times
		for (uint256 i = 0; i < numTransfers; i++) {
			vm.prank(bob);
			token.transferFrom(alice, carol, transferAmount);
		}

		uint256 finalAllowance = token.allowance(alice, bob);
		uint256 totalTransferred = transferAmount * numTransfers;

		assertApproxEqAbs(finalAllowance, initialAllowance - totalTransferred, numTransfers, "Allowance should decrease by total transferred");
	}

	/*//////////////////////////////////////////////////////////////
                        BURN MODE SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Switch between burn mode and normal mode
	function testStateful_BurnModeSwitch(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 10);

		uint256 initialSupply = token.totalSupply();

		// Enable burn mode
		token.setFeeRecipient(address(0));

		// Transfer in burn mode (tax should be burned)
		vm.prank(alice);
		token.transfer(bob, amount);

		uint256 supplyAfterBurn = token.totalSupply();
		assertLt(supplyAfterBurn, initialSupply, "Supply should decrease in burn mode");

		// Disable burn mode
		token.setFeeRecipient(feeRecipient);

		// Transfer in normal mode (tax should go to treasury)
		uint256 treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(bob);
		token.transfer(carol, amount);

		assertGt(token.balanceOf(feeRecipient), treasuryBefore, "Treasury should receive tax after disabling burn mode");
		assertEq(token.totalSupply(), supplyAfterBurn, "Supply should not change in normal mode");
	}

	/*//////////////////////////////////////////////////////////////
                        EDGE CASE SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Maximum tax with various transfer patterns
	function testStateful_MaxTaxScenarios(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 20);

		// Set maximum taxes (within combined cap)
		token.setTaxesImmediate(400, 400, 500); // 4% + 4% = 8% for sells, 5% for buys

		token.addPool(pool1);

		// Regular transfer (4%)
		uint256 treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(alice);
		token.transfer(bob, amount);
		uint256 regularTax = token.balanceOf(feeRecipient) - treasuryBefore;
		assertEq(regularTax, (amount * 400) / BASIS_POINTS_DENOMINATOR, "Regular tax should be 4%");

		// Sell to pool (4% + 4% = 8%)
		treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(bob);
		token.transfer(pool1, amount);
		uint256 sellTax = token.balanceOf(feeRecipient) - treasuryBefore;
		assertEq(sellTax, (amount * 800) / BASIS_POINTS_DENOMINATOR, "Sell tax should be 8%");

		// Give tokens to pool
		token.transfer(pool1, amount * 2);

		// Buy from pool (5%)
		treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(pool1);
		token.transfer(carol, amount);
		uint256 buyTax = token.balanceOf(feeRecipient) - treasuryBefore;
		assertEq(buyTax, (amount * 500) / BASIS_POINTS_DENOMINATOR, "Buy tax should be 5%");
	}

	/// @notice Stateful test: Rapid pool status changes
	function testStateful_RapidPoolChanges(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= token.balanceOf(alice) / 20);

		for (uint256 i = 0; i < 5; i++) {
			// Add pool
			token.addPool(pool1);

			// Transfer to pool
			vm.prank(alice);
			token.transfer(pool1, amount);

			// Remove pool
			token.removePool(pool1);

			// Transfer from former pool
			vm.prank(pool1);
			token.transfer(bob, amount / 2);
		}

		// Verify balances are consistent
		uint256 totalSupply = token.totalSupply();
		uint256 sumBalances = token.balanceOf(alice) +
			token.balanceOf(bob) +
			token.balanceOf(carol) +
			token.balanceOf(pool1) +
			token.balanceOf(feeRecipient) +
			token.balanceOf(owner);

		assertEq(sumBalances, totalSupply, "Sum of balances should equal total supply after rapid changes");
	}

	/*//////////////////////////////////////////////////////////////
                        STRESS TEST SCENARIOS
  //////////////////////////////////////////////////////////////*/

	/// @notice Stateful test: Complex multi-actor scenario
	function testStateful_ComplexMultiActorScenario(uint256 seed) public {
		uint256 amount = bound(seed, 1000, token.balanceOf(alice) / 50);

		// Setup
		token.addPool(pool1);
		vm.prank(alice);
		token.delegate(alice);
		vm.prank(bob);
		token.delegate(bob);

		uint256 initialSupply = token.totalSupply();

		// Execute complex sequence
		vm.prank(alice);
		token.transfer(bob, amount); // Transfer

		vm.prank(bob);
		token.approve(carol, amount); // Approve

		vm.prank(carol);
		token.transferFrom(bob, pool1, amount / 2); // TransferFrom to pool (sell)

		token.transfer(pool1, amount * 2); // Give more tokens to pool

		vm.prank(pool1);
		token.transfer(alice, amount); // Buy

		vm.prank(alice);
		token.burn(amount / 4); // Burn

		token.mint(carol, amount / 2); // Mint

		// Verify final state is consistent
		uint256 finalSupply = token.totalSupply();

		// Supply should have decreased by burn and increased by mint
		assertApproxEqAbs(finalSupply, initialSupply - amount / 4 + amount / 2, 1e18, "Supply changes should match operations");

		// Sum of all balances should equal total supply
		uint256 sumBalances = token.balanceOf(alice) +
			token.balanceOf(bob) +
			token.balanceOf(carol) +
			token.balanceOf(pool1) +
			token.balanceOf(feeRecipient) +
			token.balanceOf(owner);

		assertEq(sumBalances, finalSupply, "Sum of balances should equal total supply");
	}
}
