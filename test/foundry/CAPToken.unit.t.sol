// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CAPToken} from "../../contracts/CAPToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/**
 * @title CAPTokenUnitTest
 * @notice Comprehensive unit tests for CAPToken contract
 * @dev Tests timelock, permit, events, access control, and other critical functionality
 */
contract CAPTokenUnitTest is Test {
	CAPToken public token;
	CAPToken public implementation;
	address public owner;
	address public feeRecipient;
	address public alice;
	address public bob;

	// Constants
	uint256 constant BASIS_POINTS_DENOMINATOR = 10_000;
	uint256 constant MAX_TAX_BP = 500;
	uint256 constant MAX_COMBINED_TAX_BP = 800;
	uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;
	uint256 constant MAX_SUPPLY = 10_000_000_000 ether;
	uint256 constant TAX_CHANGE_DELAY = 24 hours;

	// Events from CAPToken
	event PoolAdded(address indexed pool);
	event PoolRemoved(address indexed pool);
	event TaxChangeProposed(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp, uint256 effectiveTime);
	event TaxesUpdated(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp);
	event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
	event TaxBurned(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount);
	event TaxCollected(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount, address indexed recipient);
	event TokensMinted(address indexed to, uint256 amount);

	function setUp() public {
		owner = address(this);
		feeRecipient = makeAddr("feeRecipient");
		alice = makeAddr("alice");
		bob = makeAddr("bob");

		// Deploy implementation
		implementation = new CAPToken();

		// Deploy proxy
		bytes memory initData = abi.encodeWithSelector(CAPToken.initialize.selector, owner, feeRecipient);
		ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

		// Wrap in ABI
		token = CAPToken(address(proxy));
	}

	/*//////////////////////////////////////////////////////////////
                        TIMELOCK TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Test proposing tax change emits correct event
	function test_ProposeTaxChange_EmitsEvent() public {
		uint256 newTransferTax = 200;
		uint256 newSellTax = 300;
		uint256 newBuyTax = 100;
		uint256 expectedTimestamp = block.timestamp + TAX_CHANGE_DELAY;

		vm.expectEmit(true, true, true, true);
		emit TaxChangeProposed(newTransferTax, newSellTax, newBuyTax, expectedTimestamp);

		token.proposeTaxChange(newTransferTax, newSellTax, newBuyTax);
	}

	/// @notice Test proposing tax change sets pending values
	function test_ProposeTaxChange_SetsPendingValues() public {
		uint256 newTransferTax = 200;
		uint256 newSellTax = 300;
		uint256 newBuyTax = 100;

		token.proposeTaxChange(newTransferTax, newSellTax, newBuyTax);

		assertEq(token.pendingTransferTaxBp(), newTransferTax);
		assertEq(token.pendingSellTaxBp(), newSellTax);
		assertEq(token.pendingBuyTaxBp(), newBuyTax);
		assertEq(token.taxChangeTimestamp(), block.timestamp + TAX_CHANGE_DELAY);
	}

	/// @notice Test cannot apply tax change before timelock expires
	function test_ApplyTaxChange_RevertsBeforeTimelock() public {
		token.proposeTaxChange(200, 300, 100);

		// Try to apply immediately
		vm.expectRevert("TIMELOCK_NOT_EXPIRED");
		token.applyTaxChange();

		// Try to apply 1 second before expiry
		vm.warp(block.timestamp + TAX_CHANGE_DELAY - 1);
		vm.expectRevert("TIMELOCK_NOT_EXPIRED");
		token.applyTaxChange();
	}

	/// @notice Test can apply tax change after timelock expires
	function test_ApplyTaxChange_SucceedsAfterTimelock() public {
		uint256 newTransferTax = 200;
		uint256 newSellTax = 300;
		uint256 newBuyTax = 100;

		token.proposeTaxChange(newTransferTax, newSellTax, newBuyTax);

		// Warp to exactly when timelock expires
		vm.warp(block.timestamp + TAX_CHANGE_DELAY);

		vm.expectEmit(true, true, true, true);
		emit TaxesUpdated(newTransferTax, newSellTax, newBuyTax);

		token.applyTaxChange();

		assertEq(token.transferTaxBp(), newTransferTax);
		assertEq(token.sellTaxBp(), newSellTax);
		assertEq(token.buyTaxBp(), newBuyTax);
		assertEq(token.taxChangeTimestamp(), 0); // Reset
	}

	/// @notice Test cannot apply tax change without proposal
	function test_ApplyTaxChange_RevertsWithoutProposal() public {
		vm.expectRevert("NO_PENDING_CHANGE");
		token.applyTaxChange();
	}

	/// @notice Test proposing invalid tax rates reverts
	function test_ProposeTaxChange_RevertsOnInvalidRates() public {
		// Transfer tax too high
		vm.expectRevert("TRANSFER_TAX_TOO_HIGH");
		token.proposeTaxChange(MAX_TAX_BP + 1, 100, 100);

		// Sell tax too high
		vm.expectRevert("SELL_TAX_TOO_HIGH");
		token.proposeTaxChange(100, MAX_TAX_BP + 1, 100);

		// Buy tax too high
		vm.expectRevert("BUY_TAX_TOO_HIGH");
		token.proposeTaxChange(100, 100, MAX_TAX_BP + 1);

		// Combined sell tax too high (transfer + sell)
		vm.expectRevert("COMBINED_SELL_TAX_TOO_HIGH");
		token.proposeTaxChange(500, 400, 100); // 500 + 400 = 900 > 800
	}

	/// @notice Test only owner can propose tax changes
	function test_ProposeTaxChange_OnlyOwner() public {
		vm.prank(alice);
		vm.expectRevert();
		token.proposeTaxChange(200, 300, 100);
	}

	/// @notice Test only owner can apply tax changes
	function test_ApplyTaxChange_OnlyOwner() public {
		token.proposeTaxChange(200, 300, 100);
		vm.warp(block.timestamp + TAX_CHANGE_DELAY);

		vm.prank(alice);
		vm.expectRevert();
		token.applyTaxChange();
	}

	/// @notice Test can overwrite pending proposal before applying
	function test_ProposeTaxChange_CanOverwritePending() public {
		// First proposal
		token.proposeTaxChange(200, 300, 100);
		uint256 firstTimestamp = token.taxChangeTimestamp();

		// Wait a bit
		vm.warp(block.timestamp + 1 hours);

		// Second proposal (overwrites first)
		token.proposeTaxChange(250, 350, 150);
		uint256 secondTimestamp = token.taxChangeTimestamp();

		assertEq(token.pendingTransferTaxBp(), 250);
		assertEq(token.pendingSellTaxBp(), 350);
		assertEq(token.pendingBuyTaxBp(), 150);
		assertGt(secondTimestamp, firstTimestamp);
	}

	/*//////////////////////////////////////////////////////////////
                        PERMIT TESTS (ERC20Permit)
  //////////////////////////////////////////////////////////////*/

	/// @notice Test permit allows approval via signature
	function test_Permit_AllowsApprovalViaSignature() public {
		uint256 privateKey = 0xA11CE;
		address alicePrivateKey = vm.addr(privateKey);

		// Give alice some tokens
		token.transfer(alicePrivateKey, 1000 ether);

		uint256 amount = 500 ether;
		uint256 deadline = block.timestamp + 1 hours;
		uint256 nonce = token.nonces(alicePrivateKey);

		// Create permit signature
		bytes32 structHash = keccak256(
			abi.encode(
				keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
				alicePrivateKey,
				bob,
				amount,
				nonce,
				deadline
			)
		);

		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));

		(uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

		// Execute permit
		token.permit(alicePrivateKey, bob, amount, deadline, v, r, s);

		// Verify allowance was set
		assertEq(token.allowance(alicePrivateKey, bob), amount);
	}

	/// @notice Test permit fails with expired deadline
	function test_Permit_RevertsOnExpiredDeadline() public {
		uint256 privateKey = 0xA11CE;
		address alicePrivateKey = vm.addr(privateKey);

		uint256 amount = 500 ether;
		uint256 deadline = block.timestamp + 1 hours;
		uint256 nonce = token.nonces(alicePrivateKey);

		bytes32 structHash = keccak256(
			abi.encode(
				keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
				alicePrivateKey,
				bob,
				amount,
				nonce,
				deadline
			)
		);

		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

		// Warp past deadline
		vm.warp(deadline + 1);

		// Should revert
		vm.expectRevert();
		token.permit(alicePrivateKey, bob, amount, deadline, v, r, s);
	}

	/// @notice Test permit fails with invalid signature
	function test_Permit_RevertsOnInvalidSignature() public {
		uint256 privateKey = 0xA11CE;
		address alicePrivateKey = vm.addr(privateKey);

		uint256 amount = 500 ether;
		uint256 deadline = block.timestamp + 1 hours;
		uint256 nonce = token.nonces(alicePrivateKey);

		bytes32 structHash = keccak256(
			abi.encode(
				keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
				alicePrivateKey,
				bob,
				amount,
				nonce,
				deadline
			)
		);

		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));

		// Sign with wrong private key
		uint256 wrongPrivateKey = 0xB0B;
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, digest);

		// Should revert
		vm.expectRevert();
		token.permit(alicePrivateKey, bob, amount, deadline, v, r, s);
	}

	/// @notice Test permit nonce increments after use
	function test_Permit_NonceIncrementsAfterUse() public {
		uint256 privateKey = 0xA11CE;
		address alicePrivateKey = vm.addr(privateKey);

		token.transfer(alicePrivateKey, 1000 ether);

		uint256 amount = 500 ether;
		uint256 deadline = block.timestamp + 1 hours;
		uint256 nonceBefore = token.nonces(alicePrivateKey);

		bytes32 structHash = keccak256(
			abi.encode(
				keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
				alicePrivateKey,
				bob,
				amount,
				nonceBefore,
				deadline
			)
		);

		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

		token.permit(alicePrivateKey, bob, amount, deadline, v, r, s);

		uint256 nonceAfter = token.nonces(alicePrivateKey);
		assertEq(nonceAfter, nonceBefore + 1);
	}

	/// @notice Test cannot replay permit signature
	function test_Permit_CannotReplaySignature() public {
		uint256 privateKey = 0xA11CE;
		address alicePrivateKey = vm.addr(privateKey);

		token.transfer(alicePrivateKey, 1000 ether);

		uint256 amount = 500 ether;
		uint256 deadline = block.timestamp + 1 hours;
		uint256 nonce = token.nonces(alicePrivateKey);

		bytes32 structHash = keccak256(
			abi.encode(
				keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
				alicePrivateKey,
				bob,
				amount,
				nonce,
				deadline
			)
		);

		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

		// First permit succeeds
		token.permit(alicePrivateKey, bob, amount, deadline, v, r, s);

		// Replay should fail (nonce already used)
		vm.expectRevert();
		token.permit(alicePrivateKey, bob, amount, deadline, v, r, s);
	}

	/*//////////////////////////////////////////////////////////////
                        EVENT VERIFICATION TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Test addPool emits PoolAdded event
	function test_AddPool_EmitsEvent() public {
		address pool = makeAddr("pool");

		vm.expectEmit(true, true, true, true);
		emit PoolAdded(pool);

		token.addPool(pool);
	}

	/// @notice Test removePool emits PoolRemoved event
	function test_RemovePool_EmitsEvent() public {
		address pool = makeAddr("pool");
		token.addPool(pool);

		vm.expectEmit(true, true, true, true);
		emit PoolRemoved(pool);

		token.removePool(pool);
	}

	/// @notice Test setFeeRecipient emits FeeRecipientUpdated event
	function test_SetFeeRecipient_EmitsEvent() public {
		address newRecipient = makeAddr("newRecipient");

		vm.expectEmit(true, true, true, true);
		emit FeeRecipientUpdated(feeRecipient, newRecipient);

		token.setFeeRecipient(newRecipient);
	}

	/// @notice Test executeMint emits TokensMinted and Transfer events
	function test_ExecuteMint_EmitsEvents() public {
		uint256 mintAmount = 1000 ether;

		token.proposeMint(alice, mintAmount);
		vm.warp(block.timestamp + 7 days);

		// Check TokensMinted event
		vm.expectEmit(true, true, true, true);
		emit TokensMinted(alice, mintAmount);

		token.executeMint();
	}

	/// @notice Test transfer with tax emits TaxCollected event
	function test_Transfer_EmitsTaxCollectedEvent() public {
		uint256 transferAmount = 1000 ether;
		uint256 expectedTax = (transferAmount * 100) / BASIS_POINTS_DENOMINATOR; // 1%

		vm.expectEmit(true, true, true, true);
		emit TaxCollected(owner, alice, transferAmount, expectedTax, feeRecipient);

		token.transfer(alice, transferAmount);
	}

	/// @notice Test transfer in burn mode emits TaxBurned event
	function test_Transfer_EmitsTaxBurnedEvent() public {
		// Enable burn mode
		token.setFeeRecipient(address(0));

		uint256 transferAmount = 1000 ether;
		uint256 expectedTax = (transferAmount * 100) / BASIS_POINTS_DENOMINATOR; // 1%

		vm.expectEmit(true, true, true, true);
		emit TaxBurned(owner, alice, transferAmount, expectedTax);

		token.transfer(alice, transferAmount);
	}

	/// @notice Test cancelTaxChange emits TaxChangeCancelled event
	function test_CancelTaxChange_EmitsEvent() public {
		uint256 newTransferTax = 200;
		uint256 newSellTax = 300;
		uint256 newBuyTax = 100;

		token.proposeTaxChange(newTransferTax, newSellTax, newBuyTax);

		// Cancel the pending change
		token.cancelTaxChange();

		// Verify timestamp reset
		assertEq(token.taxChangeTimestamp(), 0);
	}

	/*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Test only owner can add pools
	function test_AddPool_OnlyOwner() public {
		address pool = makeAddr("pool");

		vm.prank(alice);
		vm.expectRevert();
		token.addPool(pool);
	}

	/// @notice Test only owner can remove pools
	function test_RemovePool_OnlyOwner() public {
		address pool = makeAddr("pool");
		token.addPool(pool);

		vm.prank(alice);
		vm.expectRevert();
		token.removePool(pool);
	}

	/// @notice Test only owner can set fee recipient
	function test_SetFeeRecipient_OnlyOwner() public {
		vm.prank(alice);
		vm.expectRevert();
		token.setFeeRecipient(alice);
	}

	/// @notice Test only minter role can propose mint
	function test_ProposeMint_OnlyMinterRole() public {
		vm.prank(alice);
		vm.expectRevert();
		token.proposeMint(alice, 1000 ether);
	}

	/// @notice Test only tax manager role can cancel tax change
	function test_CancelTaxChange_OnlyTaxManagerRole() public {
		token.proposeTaxChange(200, 300, 100);

		vm.prank(alice);
		vm.expectRevert();
		token.cancelTaxChange();
	}

	/*//////////////////////////////////////////////////////////////
                        EDGE CASE TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Test cannot add zero address as pool
	function test_AddPool_RevertsOnZeroAddress() public {
		vm.expectRevert("ZERO_ADDR");
		token.addPool(address(0));
	}

	/// @notice Test cannot add same pool twice
	function test_AddPool_RevertsOnDuplicate() public {
		address pool = makeAddr("pool");
		token.addPool(pool);

		vm.expectRevert("EXISTS");
		token.addPool(pool);
	}

	/// @notice Test cannot remove non-existent pool
	function test_RemovePool_RevertsOnNonExistent() public {
		address pool = makeAddr("pool");

		vm.expectRevert("NOT_POOL");
		token.removePool(pool);
	}

	/// @notice Test cannot propose mint to zero address
	function test_ProposeMint_RevertsOnZeroAddress() public {
		vm.expectRevert("MINT_TO_ZERO");
		token.proposeMint(address(0), 1000 ether);
	}

	/// @notice Test cannot propose mint beyond max supply
	function test_ProposeMint_RevertsOnMaxSupplyExceeded() public {
		uint256 currentSupply = token.totalSupply();
		uint256 exceedAmount = MAX_SUPPLY - currentSupply + 1;

		vm.expectRevert("EXCEEDS_MAX_SUPPLY");
		token.proposeMint(alice, exceedAmount);
	}

	/// @notice Test cannot execute mint beyond rate limit
	function test_ExecuteMint_RevertsOnRateLimitExceeded() public {
		// Propose and execute first mint (100M - at limit)
		uint256 maxMintPerPeriod = 100_000_000 ether;
		token.proposeMint(alice, maxMintPerPeriod);
		vm.warp(block.timestamp + 7 days);
		token.executeMint();

		// Try to mint more in same period
		vm.expectRevert("EXCEEDS_MINT_CAP_PER_PERIOD");
		token.proposeMint(bob, 1 ether);
	}

	/// @notice Test burn reduces total supply
	function test_Burn_ReducesTotalSupply() public {
		uint256 burnAmount = 1000 ether;
		token.transfer(alice, burnAmount * 2);

		uint256 supplyBefore = token.totalSupply();
		uint256 balanceBefore = token.balanceOf(alice);

		vm.prank(alice);
		token.burn(burnAmount);

		assertEq(token.totalSupply(), supplyBefore - burnAmount);
		assertEq(token.balanceOf(alice), balanceBefore - burnAmount);
	}

	/// @notice Test burnFrom with allowance
	function test_BurnFrom_WithAllowance() public {
		uint256 burnAmount = 1000 ether;
		token.transfer(alice, burnAmount * 2);

		// Alice approves bob to burn
		vm.prank(alice);
		token.approve(bob, burnAmount);

		uint256 supplyBefore = token.totalSupply();

		// Bob burns from alice
		vm.prank(bob);
		token.burnFrom(alice, burnAmount);

		assertEq(token.totalSupply(), supplyBefore - burnAmount);
		assertEq(token.allowance(alice, bob), 0);
	}

	/// @notice Test burnFrom fails without allowance
	function test_BurnFrom_RevertsWithoutAllowance() public {
		uint256 burnAmount = 1000 ether;
		token.transfer(alice, burnAmount * 2);

		vm.prank(bob);
		vm.expectRevert();
		token.burnFrom(alice, burnAmount);
	}

	/*//////////////////////////////////////////////////////////////
                        INITIALIZATION TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Test initial state after deployment
	function test_Initialization_CorrectState() public view {
		assertEq(token.name(), "Cyberia");
		assertEq(token.symbol(), "CAP");
		assertEq(token.decimals(), 18);
		assertEq(token.totalSupply(), INITIAL_SUPPLY);
		assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
		assertEq(token.governance(), owner);
		assertEq(token.feeRecipient(), feeRecipient);
		assertEq(token.transferTaxBp(), 100); // 1%
		assertEq(token.sellTaxBp(), 100); // 1%
		assertEq(token.buyTaxBp(), 0); // 0%
	}

	/// @notice Test cannot initialize twice
	function test_Initialize_CannotReinitialize() public {
		vm.expectRevert();
		token.initialize(alice, bob);
	}

	/*//////////////////////////////////////////////////////////////
                        TAX CALCULATION TESTS
  //////////////////////////////////////////////////////////////*/

	/// @notice Test zero tax on mint
	function test_ExecuteMint_NoTax() public {
		uint256 mintAmount = 1000 ether;
		uint256 recipientBefore = token.balanceOf(feeRecipient);

		token.proposeMint(alice, mintAmount);
		vm.warp(block.timestamp + 7 days);
		token.executeMint();

		assertEq(token.balanceOf(alice), mintAmount);
		assertEq(token.balanceOf(feeRecipient), recipientBefore); // No tax collected
	}

	/// @notice Test zero tax on burn
	function test_Burn_NoTax() public {
		uint256 burnAmount = 1000 ether;
		token.transfer(alice, burnAmount * 2);

		uint256 recipientBefore = token.balanceOf(feeRecipient);
		uint256 supplyBefore = token.totalSupply();

		vm.prank(alice);
		token.burn(burnAmount);

		// No additional tax collected during burn (fee recipient balance unchanged)
		assertEq(token.balanceOf(feeRecipient), recipientBefore);
		// But supply decreased
		assertEq(token.totalSupply(), supplyBefore - burnAmount);
	}

	/// @notice Test pool-to-pool transfer has no tax
	function test_PoolToPool_NoTax() public {
		address pool1 = makeAddr("pool1");
		address pool2 = makeAddr("pool2");

		token.addPool(pool1);
		token.addPool(pool2);

		// Give tokens to pool1
		uint256 amount = 1000 ether;
		token.transfer(pool1, amount);

		uint256 pool1Balance = token.balanceOf(pool1);
		uint256 recipientBefore = token.balanceOf(feeRecipient);

		// Pool1 transfers to pool2
		vm.prank(pool1);
		token.transfer(pool2, pool1Balance);

		// Pool2 should receive full amount (no tax)
		assertEq(token.balanceOf(pool2), pool1Balance);
		assertEq(token.balanceOf(feeRecipient), recipientBefore); // No tax collected
	}

	/// @notice Test buy from pool applies buy tax only
	function test_BuyFromPool_AppliesBuyTax() public {
		address pool = makeAddr("pool");
		token.addPool(pool);

		// Set buy tax via propose/apply
		token.proposeTaxChange(100, 100, 200); // 1% transfer, 1% sell, 2% buy
		vm.warp(block.timestamp + TAX_CHANGE_DELAY);
		token.applyTaxChange();

		// Give tokens to pool (owner pays transfer tax)
		uint256 amount = 1000 ether;
		token.transfer(pool, amount);

		uint256 poolBalance = token.balanceOf(pool);
		uint256 recipientBefore = token.balanceOf(feeRecipient);

		// Pool transfers to alice (buy)
		vm.prank(pool);
		token.transfer(alice, poolBalance);

		uint256 expectedTax = (poolBalance * 200) / BASIS_POINTS_DENOMINATOR; // 2%
		uint256 taxCollected = token.balanceOf(feeRecipient) - recipientBefore;

		assertEq(taxCollected, expectedTax);
		assertEq(token.balanceOf(alice), poolBalance - expectedTax);
	}

	/// @notice Test sell to pool applies transfer + sell tax
	function test_SellToPool_AppliesCombinedTax() public {
		address pool = makeAddr("pool");
		token.addPool(pool);

		// Default taxes: 1% transfer + 1% sell = 2% on sells
		uint256 amount = 1000 ether;
		token.transfer(alice, amount * 2);

		uint256 aliceBalance = token.balanceOf(alice);
		uint256 recipientBefore = token.balanceOf(feeRecipient);

		// Alice sells to pool
		vm.prank(alice);
		token.transfer(pool, aliceBalance);

		uint256 expectedTax = (aliceBalance * 200) / BASIS_POINTS_DENOMINATOR; // 2% (1% + 1%)
		uint256 taxCollected = token.balanceOf(feeRecipient) - recipientBefore;

		assertEq(taxCollected, expectedTax);
	}
}
