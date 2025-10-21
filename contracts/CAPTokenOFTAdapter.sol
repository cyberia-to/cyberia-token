// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OFTAdapter} from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CAPTokenOFTAdapter
 * @notice LayerZero OFT Adapter for CAP token with fee-on-transfer support
 * @dev This contract adapts the existing CAP ERC20 token for cross-chain transfers via LayerZero V2
 *
 * ## Architecture
 * - Deployed on Ethereum (source chain where CAP token exists)
 * - Locks CAP tokens when users bridge to other chains
 * - Unlocks CAP tokens when users bridge back from other chains
 * - Works with CAPTokenOFT contracts deployed on destination chains
 *
 * ## Fee-on-Transfer Handling
 * The CAP token implements a configurable tax system (default 1% transfer + 1% sell tax).
 * This adapter MUST handle fee-on-transfer correctly to prevent supply inflation.
 *
 * **Solution**: Override `_debit()` and `_credit()` to:
 * - Check contract balance before transfer
 * - Execute transfer
 * - Check contract balance after transfer
 * - Use actual received amount (after tax) for cross-chain message
 *
 * ## Bridge Fee (1% Transfer Tax)
 * **IMPORTANT**: This adapter should NOT be added as a pool in the CAP token.
 *
 * CAP token has a hybrid tax system:
 * - User → User (non-pool): 1% transfer tax
 * - User → Pool: 2% sell tax (1% sell + 1% transfer)
 * - Pool → User: 0% buy tax
 *
 * **Recommended Configuration (Adapter as NON-pool)**:
 * - Bridging OUT (ETH → L2): User pays 1% transfer tax
 * - Bridging IN (L2 → ETH): User pays 1% transfer tax
 * - Round trip cost: ~2% (industry standard for taxed tokens)
 * - Tax revenue goes to DAO treasury
 *
 * **NOT Recommended (Adapter as pool)**:
 * - Bridging OUT: User pays 2% sell tax (worse than 1%)
 * - Bridging IN: User pays 0% buy tax
 * - DO NOT use this configuration
 *
 * The 1% bridge fee is intentional and serves to:
 * - Generate DAO revenue from cross-chain transfers
 * - Keep liquidity concentrated on Ethereum mainnet
 * - Discourage excessive fragmentation across chains
 *
 * ## Security
 * - Uses official LayerZero OFTAdapter base contract
 * - Implements pre/post balance checks for accurate accounting
 * - Prevents supply inflation across chains
 * - Owner should be governance/DAO multisig
 *
 * ## Deployment
 * 1. Deploy OFTAdapter on Ethereum with CAP token address
 * 2. Deploy CAPTokenOFT on destination chains (Arbitrum, Optimism, Base, etc.)
 * 3. Configure peer connections bidirectionally
 * 4. DO NOT add adapter as pool (keep as non-pool for 1% tax instead of 2%)
 * 5. Test with small amounts before going live
 * 6. Communicate 1% bridge fee to users in UI/documentation
 *
 * @custom:security-contact security@cyberia.to
 */
contract CAPTokenOFTAdapter is OFTAdapter {
	using SafeERC20 for IERC20;

	/**
	 * @notice Emitted when tokens are locked in the adapter
	 * @param sender Address that initiated the bridge
	 * @param amountSent Amount deducted from sender (before tax)
	 * @param amountLocked Actual amount locked in adapter (after tax)
	 * @param dstEid Destination chain endpoint ID
	 */
	event TokensLocked(address indexed sender, uint256 amountSent, uint256 amountLocked, uint32 dstEid);

	/**
	 * @notice Emitted when tokens are unlocked from the adapter
	 * @param recipient Address receiving the unlocked tokens
	 * @param amountRequested Amount requested to unlock
	 * @param amountReceived Actual amount received by recipient (after any tax)
	 */
	event TokensUnlocked(address indexed recipient, uint256 amountRequested, uint256 amountReceived);

	/**
	 * @notice Initialize the OFT Adapter
	 * @param _token The CAP token address on Ethereum
	 * @param _lzEndpoint The LayerZero V2 endpoint address for Ethereum
	 * @param _owner The owner address (should be governance/DAO)
	 *
	 * LayerZero V2 Endpoints:
	 * - Ethereum Mainnet: 0x1a44076050125825900e736c501f859c50fE728c
	 * - Ethereum Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
	 */
	constructor(address _token, address _lzEndpoint, address _owner) OFTAdapter(_token, _lzEndpoint, _owner) Ownable(_owner) {}

	/**
	 * @notice Locks tokens from sender with fee-on-transfer support
	 * @dev Overrides the default OFTAdapter implementation to handle CAP token's transfer tax
	 *
	 * @param _from The address to debit from (msg.sender in send() context)
	 * @param _amountLD The amount of tokens requested to send in local decimals
	 * @param _minAmountLD The minimum amount to send in local decimals (slippage protection)
	 * @param _dstEid The destination chain ID
	 * @return amountSentLD The amount deducted from sender (before tax)
	 * @return amountReceivedLD The actual amount locked in contract (after tax)
	 *
	 * ## Flow
	 * 1. Check adapter's balance before transfer
	 * 2. Transfer tokens from sender to adapter (safeTransferFrom)
	 * 3. Check adapter's balance after transfer
	 * 4. Calculate actual received amount (balanceAfter - balanceBefore)
	 * 5. Ensure actual amount >= minimum required (slippage protection)
	 * 6. Return both sent and received amounts for accurate cross-chain accounting
	 *
	 * ## Example (with 1% transfer tax)
	 * - User sends 100 CAP
	 * - Transfer tax: 1 CAP (1%)
	 * - Adapter receives: 99 CAP
	 * - amountSentLD = 100, amountReceivedLD = 99
	 * - Destination chain mints exactly 99 CAP (supply stays constant)
	 *
	 * ## Example (with pool exemption)
	 * - User sends 100 CAP
	 * - Transfer tax: 0 CAP (adapter is pool)
	 * - Adapter receives: 100 CAP
	 * - amountSentLD = 100, amountReceivedLD = 100
	 * - Destination chain mints exactly 100 CAP
	 */
	function _debit(
		address _from,
		uint256 _amountLD,
		uint256 _minAmountLD,
		uint32 _dstEid
	) internal override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
		// Get balance before transfer
		uint256 balanceBefore = innerToken.balanceOf(address(this));

		// Transfer tokens from user to adapter (will trigger CAP token's _update which may apply tax)
		// Note: User must have approved this adapter to spend their tokens
		innerToken.safeTransferFrom(_from, address(this), _amountLD);

		// Get balance after transfer
		uint256 balanceAfter = innerToken.balanceOf(address(this));

		// Calculate actual amount received (after any transfer tax)
		amountReceivedLD = balanceAfter - balanceBefore;

		// Slippage protection: ensure we received at least the minimum amount
		// This protects users from unexpected high tax rates
		require(amountReceivedLD >= _minAmountLD, "CAPOFTAdapter: slippage exceeded");

		// amountSentLD is what was requested/deducted from user
		// amountReceivedLD is what adapter actually received (may be less due to tax)
		// The OFTCore will send amountReceivedLD to destination chain, maintaining supply invariant
		amountSentLD = _amountLD;

		emit TokensLocked(_from, amountSentLD, amountReceivedLD, _dstEid);
	}

	/**
	 * @notice Unlocks tokens to recipient with fee-on-transfer support
	 * @dev Overrides the default OFTAdapter implementation to handle potential transfer tax on unlock
	 *
	 * @param _to The address to credit the tokens to
	 * @param _amountLD The amount of tokens to credit in local decimals
	 * @param _srcEid The source chain ID (unused but required by interface)
	 * @return amountReceivedLD The actual amount received by recipient (after any tax)
	 *
	 * ## Flow
	 * 1. Check recipient's balance before transfer
	 * 2. Transfer tokens from adapter to recipient (safeTransfer)
	 * 3. Check recipient's balance after transfer
	 * 4. Calculate actual received amount (balanceAfter - balanceBefore)
	 * 5. Return actual received amount
	 *
	 * ## Example (with pool exemption - recommended)
	 * - Adapter sends 99 CAP
	 * - Transfer tax: 0 CAP (adapter is pool, exempt)
	 * - Recipient receives: 99 CAP
	 * - amountReceivedLD = 99
	 *
	 * ## Example (without pool exemption - not recommended)
	 * - Adapter sends 99 CAP
	 * - Transfer tax: ~1 CAP (1% of 99)
	 * - Recipient receives: ~98 CAP
	 * - amountReceivedLD = 98
	 * - User loses 2 CAP total (1% on lock + 1% on unlock)
	 *
	 * ## Note
	 * If adapter is properly added as pool, the tax should be 0 and recipient receives full amount.
	 */
	function _credit(address _to, uint256 _amountLD, uint32 _srcEid) internal override returns (uint256 amountReceivedLD) {
		// Get recipient's balance before transfer
		uint256 balanceBefore = innerToken.balanceOf(_to);

		// Transfer tokens from adapter to recipient
		innerToken.safeTransfer(_to, _amountLD);

		// Get recipient's balance after transfer
		uint256 balanceAfter = innerToken.balanceOf(_to);

		// Calculate actual amount received (after any transfer tax)
		// If adapter is added as pool (recommended), this should equal _amountLD
		amountReceivedLD = balanceAfter - balanceBefore;

		emit TokensUnlocked(_to, _amountLD, amountReceivedLD);
	}
}
