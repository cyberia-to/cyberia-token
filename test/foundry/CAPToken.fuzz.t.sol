// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CAPToken} from "../../contracts/CAPToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title CAPTokenFuzzTest
 * @notice Comprehensive fuzz testing for CAPToken contract
 * @dev Uses Foundry's fuzzing capabilities to test edge cases and properties
 */
contract CAPTokenFuzzTest is Test {
	CAPToken public token;
	CAPToken public implementation;
	address public owner;
	address public feeRecipient;

	// Constants from contract
	uint256 constant BASIS_POINTS_DENOMINATOR = 10_000;
	uint256 constant MAX_TAX_BP = 500;
	uint256 constant MAX_COMBINED_TAX_BP = 800;
	uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;
	uint256 constant MAX_SUPPLY = 10_000_000_000 ether;

	function setUp() public {
		owner = address(this);
		feeRecipient = makeAddr("feeRecipient");

		// Deploy implementation
		implementation = new CAPToken();

		// Deploy proxy
		bytes memory initData = abi.encodeWithSelector(CAPToken.initialize.selector, owner, feeRecipient);
		ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

		// Wrap in ABI
		token = CAPToken(address(proxy));
	}

	/*//////////////////////////////////////////////////////////////
                        TRANSFER FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Transfer should never exceed sender's balance
	function testFuzz_TransferNeverExceedsBalance(address to, uint256 amount) public {
		vm.assume(to != address(0));
		vm.assume(to != address(token));
		vm.assume(amount > 0);

		uint256 senderBalance = token.balanceOf(owner);

		if (amount > senderBalance) {
			// Should revert if trying to transfer more than balance
			vm.expectRevert();
			token.transfer(to, amount);
		} else {
			// Should succeed if amount <= balance
			uint256 balanceBefore = token.balanceOf(to);
			token.transfer(to, amount);
			assertGe(token.balanceOf(to), balanceBefore, "Recipient balance should increase");
		}
	}

	/// @notice Fuzz test: Transfer between valid addresses with various amounts
	function testFuzz_TransferBetweenUsers(address from, address to, uint256 seedAmount, uint256 transferAmount) public {
		vm.assume(from != address(0) && to != address(0));
		vm.assume(from != to);
		vm.assume(from != address(token));
		vm.assume(to != address(token));
		vm.assume(to != feeRecipient);
		vm.assume(seedAmount > 0 && seedAmount <= INITIAL_SUPPLY / 2);

		// Give tokens to 'from'
		token.transfer(from, seedAmount);

		uint256 fromBalanceBefore = token.balanceOf(from);
		vm.assume(transferAmount > 0 && transferAmount <= fromBalanceBefore); // Use actual balance after tax

		uint256 toBalanceBefore = token.balanceOf(to);
		uint256 treasuryBefore = token.balanceOf(feeRecipient);

		// Execute transfer
		vm.prank(from);
		token.transfer(to, transferAmount);

		uint256 fromBalanceAfter = token.balanceOf(from);
		uint256 toBalanceAfter = token.balanceOf(to);
		uint256 treasuryAfter = token.balanceOf(feeRecipient);

		// Verify balance changes
		assertEq(fromBalanceBefore - fromBalanceAfter, transferAmount, "From balance should decrease by exact amount");
		assertLe(toBalanceAfter - toBalanceBefore, transferAmount, "To should receive <= transfer amount (due to tax)");
		assertGe(treasuryAfter, treasuryBefore, "Treasury should receive tax or stay same");

		// Verify conservation (no tokens created/destroyed)
		uint256 totalChange = (fromBalanceBefore - fromBalanceAfter) - (toBalanceAfter - toBalanceBefore) - (treasuryAfter - treasuryBefore);
		assertEq(totalChange, 0, "Sum of balance changes should equal zero");
	}

	/*//////////////////////////////////////////////////////////////
                        TAX CALCULATION FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Tax calculation should never overflow
	function testFuzz_TaxCalculationNoOverflow(uint256 transferAmount) public {
		vm.assume(transferAmount > 100); // Minimum for meaningful tax
		vm.assume(transferAmount <= INITIAL_SUPPLY);

		address user = makeAddr("user");

		uint256 balanceBefore = token.balanceOf(user);

		// Should not revert due to overflow
		token.transfer(user, transferAmount);

		uint256 balanceAfter = token.balanceOf(user);

		// User should receive less than transferred (due to 1% tax)
		assertLt(balanceAfter - balanceBefore, transferAmount, "Tax should be deducted");
		assertGt(balanceAfter, balanceBefore, "User should receive tokens");
	}

	/// @notice Fuzz test: Tax amount should be deterministic
	function testFuzz_TaxDeterminism(uint256 amount) public {
		vm.assume(amount > 1000 && amount <= INITIAL_SUPPLY / 10);

		address user1 = makeAddr("user1");
		address user2 = makeAddr("user2");

		// Give tokens to users
		token.transfer(user1, amount);
		token.transfer(user2, amount);

		uint256 treasuryBefore1 = token.balanceOf(feeRecipient);
		vm.prank(user1);
		token.transfer(owner, amount / 2);
		uint256 tax1 = token.balanceOf(feeRecipient) - treasuryBefore1;

		uint256 treasuryBefore2 = token.balanceOf(feeRecipient);
		vm.prank(user2);
		token.transfer(owner, amount / 2);
		uint256 tax2 = token.balanceOf(feeRecipient) - treasuryBefore2;

		assertEq(tax1, tax2, "Same transfer amount should produce same tax");
	}

	/// @notice Fuzz test: Tax should scale linearly with amount
	function testFuzz_TaxLinearity(uint256 baseAmount) public {
		vm.assume(baseAmount > 10000 && baseAmount <= INITIAL_SUPPLY / 20);

		address user1 = makeAddr("user1");
		address user2 = makeAddr("user2");

		token.transfer(user1, baseAmount * 4);
		token.transfer(user2, baseAmount * 4);

		// Transfer baseAmount
		uint256 treasuryBefore1 = token.balanceOf(feeRecipient);
		vm.prank(user1);
		token.transfer(owner, baseAmount);
		uint256 tax1 = token.balanceOf(feeRecipient) - treasuryBefore1;

		// Transfer 2x baseAmount
		uint256 treasuryBefore2 = token.balanceOf(feeRecipient);
		vm.prank(user2);
		token.transfer(owner, baseAmount * 2);
		uint256 tax2 = token.balanceOf(feeRecipient) - treasuryBefore2;

		// Tax should be approximately 2x (allow for rounding)
		assertApproxEqAbs(tax2, tax1 * 2, 2, "Tax should scale linearly");
	}

	/// @notice Fuzz test: Valid tax rates should always work
	function testFuzz_ValidTaxRates(uint16 transferTax, uint16 sellTax, uint16 buyTax) public {
		vm.assume(transferTax <= MAX_TAX_BP);
		vm.assume(sellTax <= MAX_TAX_BP);
		vm.assume(buyTax <= MAX_TAX_BP);
		vm.assume(transferTax + sellTax <= MAX_COMBINED_TAX_BP);

		// Should not revert for valid tax rates
		token.setTaxesImmediate(transferTax, sellTax, buyTax);

		assertEq(token.transferTaxBp(), transferTax);
		assertEq(token.sellTaxBp(), sellTax);
		assertEq(token.buyTaxBp(), buyTax);
	}

	/// @notice Fuzz test: Invalid tax rates should revert
	function testFuzz_InvalidTaxRatesRevert(uint256 transferTax, uint256 sellTax, uint256 buyTax) public {
		vm.assume(
			transferTax > MAX_TAX_BP ||
				sellTax > MAX_TAX_BP ||
				buyTax > MAX_TAX_BP ||
				(transferTax + sellTax > MAX_COMBINED_TAX_BP && transferTax <= MAX_TAX_BP && sellTax <= MAX_TAX_BP)
		);

		// Should revert for invalid tax rates
		vm.expectRevert();
		token.setTaxesImmediate(transferTax, sellTax, buyTax);
	}

	/*//////////////////////////////////////////////////////////////
                        ALLOWANCE FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Allowance mechanism with random amounts
	function testFuzz_AllowanceMechanism(address spender, uint256 allowanceAmount, uint256 spendAmount) public {
		vm.assume(spender != address(0));
		vm.assume(spender != owner);
		vm.assume(spender != feeRecipient);
		vm.assume(allowanceAmount > 0 && allowanceAmount <= INITIAL_SUPPLY);
		vm.assume(spendAmount > 0 && spendAmount <= allowanceAmount);

		address recipient = makeAddr("recipient");
		vm.assume(recipient != feeRecipient);

		// Approve spender
		token.approve(spender, allowanceAmount);
		assertEq(token.allowance(owner, spender), allowanceAmount, "Allowance should be set");

		// Check if we have enough balance
		uint256 ownerBalance = token.balanceOf(owner);
		if (spendAmount > ownerBalance) {
			// Should revert if trying to spend more than balance
			vm.prank(spender);
			vm.expectRevert();
			token.transferFrom(owner, recipient, spendAmount);
		} else {
			// Should succeed
			vm.prank(spender);
			token.transferFrom(owner, recipient, spendAmount);

			uint256 remainingAllowance = token.allowance(owner, spender);

			// Check if max allowance was used (special case in OpenZeppelin)
			if (allowanceAmount == type(uint256).max) {
				assertEq(remainingAllowance, type(uint256).max, "Max allowance should remain");
			} else {
				assertEq(remainingAllowance, allowanceAmount - spendAmount, "Allowance should decrease");
			}
		}
	}

	/*//////////////////////////////////////////////////////////////
                        SUPPLY FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Total supply should remain consistent
	function testFuzz_TotalSupplyConsistency(address user, uint256 transferAmount) public {
		vm.assume(user != address(0));
		vm.assume(user != owner);
		vm.assume(user != feeRecipient);
		vm.assume(transferAmount > 0 && transferAmount <= INITIAL_SUPPLY / 2);

		uint256 totalSupplyBefore = token.totalSupply();

		// Transfer tokens
		token.transfer(user, transferAmount);

		uint256 totalSupplyAfter = token.totalSupply();

		// Total supply should not change (fees go to feeRecipient, not burned)
		assertEq(totalSupplyAfter, totalSupplyBefore, "Total supply should remain constant");
	}

	/// @notice Fuzz test: Mint should respect max supply
	function testFuzz_MintRespectsMaxSupply(uint256 mintAmount) public {
		uint256 currentSupply = token.totalSupply();
		uint256 available = MAX_SUPPLY - currentSupply;

		vm.assume(mintAmount > 0 && mintAmount < type(uint256).max - currentSupply); // Prevent overflow

		if (mintAmount <= available) {
			// Should succeed
			token.mint(owner, mintAmount);
			assertEq(token.totalSupply(), currentSupply + mintAmount);
		} else {
			// Should revert
			vm.expectRevert("EXCEEDS_MAX_SUPPLY");
			token.mint(owner, mintAmount);
		}
	}

	/// @notice Fuzz test: Burn should always reduce supply
	function testFuzz_BurnReducesSupply(address user, uint256 seedAmount, uint256 burnAmount) public {
		vm.assume(user != address(0));
		vm.assume(seedAmount > 0 && seedAmount <= INITIAL_SUPPLY / 10);

		// Give tokens to user
		token.transfer(user, seedAmount);

		uint256 balanceBefore = token.balanceOf(user);
		vm.assume(burnAmount > 0 && burnAmount <= balanceBefore); // Use actual balance after tax

		uint256 supplyBefore = token.totalSupply();

		// Burn tokens
		vm.prank(user);
		token.burn(burnAmount);

		assertEq(token.totalSupply(), supplyBefore - burnAmount, "Supply should decrease by burn amount");
		assertEq(token.balanceOf(user), balanceBefore - burnAmount, "Balance should decrease by burn amount");
	}

	/*//////////////////////////////////////////////////////////////
                        POOL FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Pool transfers apply correct taxes
	function testFuzz_PoolTaxes(address pool, address user, uint256 amount) public {
		vm.assume(pool != address(0) && user != address(0));
		vm.assume(pool != user && pool != owner);
		vm.assume(user != feeRecipient && pool != feeRecipient);
		vm.assume(amount > 1000 && amount <= INITIAL_SUPPLY / 10);

		// Add pool
		token.addPool(pool);

		// Give tokens to user
		token.transfer(user, amount);

		// Test sell (user -> pool)
		uint256 treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(user);
		token.transfer(pool, amount / 2);
		uint256 sellTax = token.balanceOf(feeRecipient) - treasuryBefore;

		// Sell tax should be transfer + sell tax (2% with defaults)
		uint256 expectedSellTax = ((amount / 2) * 200) / BASIS_POINTS_DENOMINATOR;
		assertEq(sellTax, expectedSellTax, "Sell tax should be transfer + sell");

		// Give tokens to pool
		token.transfer(pool, amount);

		// Test buy (pool -> user)
		treasuryBefore = token.balanceOf(feeRecipient);
		vm.prank(pool);
		token.transfer(user, amount / 2);
		uint256 buyTax = token.balanceOf(feeRecipient) - treasuryBefore;

		// Buy tax should be 0% (default)
		assertEq(buyTax, 0, "Buy tax should be 0% by default");
	}

	/*//////////////////////////////////////////////////////////////
                        DELEGATION FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Delegation should not affect balance
	function testFuzz_DelegationDoesNotAffectBalance(address user, address delegate, uint256 amount) public {
		vm.assume(user != address(0) && delegate != address(0));
		vm.assume(user != owner);
		vm.assume(amount > 0 && amount <= INITIAL_SUPPLY / 10);

		// Give tokens to user
		token.transfer(user, amount);

		uint256 balanceBefore = token.balanceOf(user);

		// Delegate
		vm.prank(user);
		token.delegate(delegate);

		uint256 balanceAfter = token.balanceOf(user);

		assertEq(balanceAfter, balanceBefore, "Delegation should not change balance");
	}

	/// @notice Fuzz test: Voting power equals balance after self-delegation
	function testFuzz_VotingPowerEqualsBalance(address user, uint256 amount) public {
		vm.assume(user != address(0));
		vm.assume(user != owner);
		vm.assume(amount > 0 && amount <= INITIAL_SUPPLY / 10);

		// Give tokens to user
		token.transfer(user, amount);

		// Self-delegate
		vm.prank(user);
		token.delegate(user);

		// Roll forward to ensure checkpoint is recorded
		vm.roll(block.number + 1);

		uint256 balance = token.balanceOf(user);
		uint256 votes = token.getVotes(user);

		assertEq(votes, balance, "Voting power should equal balance after self-delegation");
	}

	/*//////////////////////////////////////////////////////////////
                        BURN MODE FUZZ TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Burn mode should reduce supply
	function testFuzz_BurnModeReducesSupply(address user, uint256 amount) public {
		vm.assume(user != address(0));
		vm.assume(user != owner);
		vm.assume(amount > 1000 && amount <= INITIAL_SUPPLY / 10);

		// Enable burn mode
		token.setFeeRecipient(address(0));

		// Give tokens to user
		token.transfer(user, amount);

		uint256 supplyBefore = token.totalSupply();

		// Transfer with burn mode
		address recipient = makeAddr("recipient");
		vm.prank(user);
		token.transfer(recipient, amount / 2);

		uint256 supplyAfter = token.totalSupply();

		// Tax should have been burned
		uint256 expectedBurn = ((amount / 2) * 100) / BASIS_POINTS_DENOMINATOR; // 1% default transfer tax
		assertEq(supplyBefore - supplyAfter, expectedBurn, "Tax should be burned in burn mode");
	}

	/*//////////////////////////////////////////////////////////////
                        INVARIANT HELPERS
  //////////////////////////////////////////////////////////////*/

	/// @notice Fuzz test: Balances should always sum to total supply
	function testFuzz_BalanceSumEqualsSupply(address user1, address user2, uint256 amount1, uint256 amount2) public {
		vm.assume(user1 != address(0) && user2 != address(0));
		vm.assume(user1 != user2);
		vm.assume(user1 != owner && user2 != owner);
		vm.assume(user1 != feeRecipient && user2 != feeRecipient);
		vm.assume(amount1 > 0 && amount1 <= INITIAL_SUPPLY / 4);
		vm.assume(amount2 > 0 && amount2 <= INITIAL_SUPPLY / 4);

		// Distribute tokens
		token.transfer(user1, amount1);
		token.transfer(user2, amount2);

		// Sum all balances
		uint256 balanceSum = token.balanceOf(owner) + token.balanceOf(user1) + token.balanceOf(user2) + token.balanceOf(feeRecipient);

		assertEq(balanceSum, token.totalSupply(), "Sum of balances should equal total supply");
	}
}
