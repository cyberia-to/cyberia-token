// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract CAPToken is
	Initializable,
	ERC20Upgradeable,
	ERC20PermitUpgradeable,
	ERC20VotesUpgradeable,
	UUPSUpgradeable,
	ReentrancyGuardUpgradeable
{
	// Governance address - the only privileged address (typically an Aragon DAO)
	address public governance;
	// Constants
	uint256 public constant BASIS_POINTS_DENOMINATOR = 10_000; // 100% = 10000 bp
	uint256 public constant MAX_TAX_BP = 500; // 5% per individual tax
	uint256 public constant MAX_COMBINED_TAX_BP = 800; // 8% combined cap for sell scenario (transfer + sell)
	uint256 public constant MAX_TOTAL_TAX_BP = 1000; // 10% global cap for any combination of all three taxes
	uint256 public constant INITIAL_SUPPLY = 1_000_000_000 ether; // 1e9 * 1e18
	uint256 public constant MAX_SUPPLY = 10_000_000_000 ether; // 10B max supply cap (10x initial)
	uint256 public constant TAX_CHANGE_DELAY = 24 hours; // Timelock delay for tax changes
	uint256 public constant MINT_DELAY = 7 days; // Timelock delay for minting operations (7 days)
	uint256 public constant MINT_CAP_PER_PERIOD = 100_000_000 ether; // Max 100M tokens per 30-day period
	uint256 public constant MINT_PERIOD = 30 days; // Rolling 30-day period for mint cap

	// Tax parameters (in basis points)
	// transferTaxBp: applied to non-pool <-> non-pool transfers and to sells in addition to sellTaxBp (hybrid rule)
	// NOTE: Tax calculation uses integer division which causes precision loss for small amounts.
	// For 18-decimal tokens: amounts < 10^(18 - floor(log10(taxBp))) may round down to zero tax.
	// Example with 1% (100bp): transfers < 10^16 wei (0.01 tokens) will have zero tax due to rounding.
	// This is acceptable behavior for standard ERC20 tokens and protects against dust attacks.
	uint256 public transferTaxBp;
	uint256 public sellTaxBp; // additional tax when user -> pool
	uint256 public buyTaxBp; // applied when pool -> user (set to 0 by default)

	// Pending tax changes (timelock)
	uint256 public pendingTransferTaxBp;
	uint256 public pendingSellTaxBp;
	uint256 public pendingBuyTaxBp;
	uint256 public taxChangeTimestamp; // When pending taxes can be applied

	// Minting controls (timelock + rate limiting)
	address public pendingMintTo;
	uint256 public pendingMintAmount;
	uint256 public mintTimestamp; // When pending mint can be executed
	uint256 public lastMintPeriodStart; // Start of current 30-day period
	uint256 public mintedInCurrentPeriod; // Amount minted in current period

	address public feeRecipient; // zero address means burn mode (burns collected taxes)
	mapping(address => bool) public isPool; // AMM pair addresses

	// Events
	event GovernanceTransferred(address indexed previousGovernance, address indexed newGovernance);
	event PoolAdded(address indexed pool);
	event PoolRemoved(address indexed pool);
	event TaxChangeProposed(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp, uint256 effectiveTime);
	event TaxChangeCancelled(uint256 cancelledTransferTaxBp, uint256 cancelledSellTaxBp, uint256 cancelledBuyTaxBp);
	event TaxesUpdated(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp);
	event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
	event TaxBurned(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount);
	event TaxCollected(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount, address indexed recipient);
	event MintProposed(address indexed to, uint256 amount, uint256 effectiveTime);
	event MintCancelled(address indexed to, uint256 amount);
	event TokensMinted(address indexed to, uint256 amount);

	/// @notice Modifier to restrict access to governance address only
	modifier onlyGovernance() {
		require(msg.sender == governance, "ONLY_GOVERNANCE");
		_;
	}

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	/// @notice Initialize the token contract
	/// @param _governance The initial governance address (deployer initially, then transfer to Aragon DAO)
	/// @param _feeRecipient The fee recipient address. Use address(0) to enable burn mode where taxes are burned instead of collected
	/// @dev SECURITY: After deployment, call setGovernance() to transfer control to the Aragon DAO
	function initialize(address _governance, address _feeRecipient) public initializer {
		require(_governance != address(0), "ZERO_GOVERNANCE");

		__ERC20_init("Cyberia", "CAP");
		__ERC20Permit_init("Cyberia");
		__ERC20Votes_init();
		__UUPSUpgradeable_init();
		__ReentrancyGuard_init();

		// Set governance address (initially deployer, then transferred to DAO)
		governance = _governance;

		// Default taxes per spec
		transferTaxBp = 100; // 1%
		sellTaxBp = 100; // 1%
		buyTaxBp = 0; // 0%

		feeRecipient = _feeRecipient; // recommended to be DAO safe; zero address enables burn mode

		// Initialize minting period tracking
		lastMintPeriodStart = block.timestamp;
		mintedInCurrentPeriod = 0;

		// Initial supply to governance address
		_mint(_governance, INITIAL_SUPPLY);
	}

	/// @notice Transfer governance to a new address (typically an Aragon DAO)
	/// @param _newGovernance The new governance address
	/// @dev Only callable by current governance. Use this to transfer control to the DAO after deployment.
	function setGovernance(address _newGovernance) external onlyGovernance {
		require(_newGovernance != address(0), "ZERO_GOVERNANCE");
		address oldGovernance = governance;
		governance = _newGovernance;
		emit GovernanceTransferred(oldGovernance, _newGovernance);
	}

	// Admin functions
	/// @notice Propose new tax rates (requires timelock delay before applying)
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function proposeTaxChange(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp) external onlyGovernance {
		require(_transferTaxBp <= MAX_TAX_BP, "TRANSFER_TAX_TOO_HIGH");
		require(_sellTaxBp <= MAX_TAX_BP, "SELL_TAX_TOO_HIGH");
		require(_buyTaxBp <= MAX_TAX_BP, "BUY_TAX_TOO_HIGH");
		// Combined cap: prevent total tax burden on sells from exceeding MAX_COMBINED_TAX_BP
		// Sells incur both transferTaxBp and sellTaxBp, so their sum must be capped
		require(_transferTaxBp + _sellTaxBp <= MAX_COMBINED_TAX_BP, "COMBINED_SELL_TAX_TOO_HIGH");
		// Global cap: prevent any single tax or combination from being too high
		// This ensures transfer+buy and other combinations are also bounded
		require(_transferTaxBp + _buyTaxBp <= MAX_TOTAL_TAX_BP, "TOTAL_TAX_TOO_HIGH");
		require(_sellTaxBp + _buyTaxBp <= MAX_TOTAL_TAX_BP, "TOTAL_TAX_TOO_HIGH");

		pendingTransferTaxBp = _transferTaxBp;
		pendingSellTaxBp = _sellTaxBp;
		pendingBuyTaxBp = _buyTaxBp;
		taxChangeTimestamp = block.timestamp + TAX_CHANGE_DELAY;

		emit TaxChangeProposed(_transferTaxBp, _sellTaxBp, _buyTaxBp, taxChangeTimestamp);
	}

	/// @notice Apply pending tax changes after timelock delay
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function applyTaxChange() external onlyGovernance {
		require(taxChangeTimestamp != 0, "NO_PENDING_CHANGE");
		require(block.timestamp >= taxChangeTimestamp, "TIMELOCK_NOT_EXPIRED");

		transferTaxBp = pendingTransferTaxBp;
		sellTaxBp = pendingSellTaxBp;
		buyTaxBp = pendingBuyTaxBp;

		// Reset pending state
		taxChangeTimestamp = 0;

		emit TaxesUpdated(transferTaxBp, sellTaxBp, buyTaxBp);
	}

	/// @notice Cancel a pending tax change before it takes effect
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function cancelTaxChange() external onlyGovernance {
		require(taxChangeTimestamp != 0, "NO_PENDING_CHANGE");

		// Store the cancelled values for the event
		uint256 cancelledTransfer = pendingTransferTaxBp;
		uint256 cancelledSell = pendingSellTaxBp;
		uint256 cancelledBuy = pendingBuyTaxBp;

		// Reset pending state
		pendingTransferTaxBp = 0;
		pendingSellTaxBp = 0;
		pendingBuyTaxBp = 0;
		taxChangeTimestamp = 0;

		emit TaxChangeCancelled(cancelledTransfer, cancelledSell, cancelledBuy);
	}

	/// @notice Update the fee recipient address
	/// @param _feeRecipient The new fee recipient address. Use address(0) to enable burn mode where taxes are burned instead of collected
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function setFeeRecipient(address _feeRecipient) external onlyGovernance {
		address oldRecipient = feeRecipient;
		feeRecipient = _feeRecipient; // zero address enables burn mode
		emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
	}

	/// @notice Add a pool address for tax calculations
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function addPool(address pool) external onlyGovernance {
		require(pool != address(0), "ZERO_ADDR");
		require(!isPool[pool], "EXISTS");
		isPool[pool] = true;
		emit PoolAdded(pool);
	}

	/// @notice Remove a pool address from tax calculations
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function removePool(address pool) external onlyGovernance {
		require(isPool[pool], "NOT_POOL");
		delete isPool[pool];
		emit PoolRemoved(pool);
	}

	function burn(uint256 amount) external {
		_burn(_msgSender(), amount);
	}

	function burnFrom(address account, uint256 amount) external {
		_spendAllowance(account, _msgSender(), amount);
		_burn(account, amount);
	}

	/// @notice Propose minting new tokens (requires 7-day timelock before executing)
	/// @dev Only callable by governance (Aragon DAO via DAO.execute()). Subject to rate limiting.
	/// @param to Address to receive minted tokens
	/// @param amount Amount of tokens to mint
	function proposeMint(address to, uint256 amount) external onlyGovernance {
		require(to != address(0), "MINT_TO_ZERO");
		require(totalSupply() + amount <= MAX_SUPPLY, "EXCEEDS_MAX_SUPPLY");

		// Reset period if needed
		if (block.timestamp >= lastMintPeriodStart + MINT_PERIOD) {
			lastMintPeriodStart = block.timestamp;
			mintedInCurrentPeriod = 0;
		}

		// Check rate limiting
		require(mintedInCurrentPeriod + amount <= MINT_CAP_PER_PERIOD, "EXCEEDS_MINT_CAP_PER_PERIOD");

		pendingMintTo = to;
		pendingMintAmount = amount;
		mintTimestamp = block.timestamp + MINT_DELAY;

		emit MintProposed(to, amount, mintTimestamp);
	}

	/// @notice Execute pending mint after timelock delay
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function executeMint() external onlyGovernance {
		require(mintTimestamp != 0, "NO_PENDING_MINT");
		require(block.timestamp >= mintTimestamp, "MINT_TIMELOCK_NOT_EXPIRED");
		require(pendingMintTo != address(0), "MINT_TO_ZERO");

		address to = pendingMintTo;
		uint256 amount = pendingMintAmount;

		// Reset period if needed
		if (block.timestamp >= lastMintPeriodStart + MINT_PERIOD) {
			lastMintPeriodStart = block.timestamp;
			mintedInCurrentPeriod = 0;
		}

		// Final checks
		require(totalSupply() + amount <= MAX_SUPPLY, "EXCEEDS_MAX_SUPPLY");
		require(mintedInCurrentPeriod + amount <= MINT_CAP_PER_PERIOD, "EXCEEDS_MINT_CAP_PER_PERIOD");

		// Update tracking
		mintedInCurrentPeriod += amount;

		// Reset pending state
		pendingMintTo = address(0);
		pendingMintAmount = 0;
		mintTimestamp = 0;

		_mint(to, amount);
		emit TokensMinted(to, amount);
	}

	/// @notice Cancel a pending mint before it takes effect
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function cancelMint() external onlyGovernance {
		require(mintTimestamp != 0, "NO_PENDING_MINT");

		address to = pendingMintTo;
		uint256 amount = pendingMintAmount;

		// Reset pending state
		pendingMintTo = address(0);
		pendingMintAmount = 0;
		mintTimestamp = 0;

		emit MintCancelled(to, amount);
	}

	// Internal tax logic applied on transfers
	function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) nonReentrant {
		// No tax on mints/burns
		if (from == address(0) || to == address(0)) {
			super._update(from, to, value);
			return;
		}

		uint256 taxBp = 0;
		bool toIsPool = isPool[to];
		bool fromIsPool = isPool[from];

		if (fromIsPool && toIsPool) {
			// Pool-to-pool transfer: no tax (liquidity migration, AMM operations)
			taxBp = 0;
		} else if (fromIsPool && !toIsPool) {
			// Buy: pool -> user
			taxBp = buyTaxBp;
		} else if (!fromIsPool && toIsPool) {
			// Sell: user -> pool
			taxBp = sellTaxBp;
			// Hybrid spec: also apply base transfer tax on sells
			taxBp += transferTaxBp;
		} else {
			// Regular transfer: user -> user (non-pool on both sides)
			taxBp = transferTaxBp;
		}

		uint256 taxAmount = (value * taxBp) / BASIS_POINTS_DENOMINATOR;
		uint256 sendAmount = value - taxAmount;

		if (taxAmount > 0) {
			if (feeRecipient == address(0)) {
				// Burn mode: reduce supply and emit Transfer(from, 0x0, taxAmount)
				super._update(from, address(0), taxAmount);
				emit TaxBurned(from, to, value, taxAmount);
			} else {
				// Transfer fee to recipient
				super._update(from, feeRecipient, taxAmount);
				emit TaxCollected(from, to, value, taxAmount, feeRecipient);
			}
		}

		// Transfer net amount to recipient
		super._update(from, to, sendAmount);
	}

	// UUPS authorization
	/// @dev Only callable by governance (Aragon DAO via DAO.execute())
	function _authorizeUpgrade(address newImplementation) internal override onlyGovernance {}

	// Required overrides for Solidity
	function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
		return super.nonces(owner);
	}

	function _maxSupply() internal pure override returns (uint256) {
		return type(uint224).max; // use Votes default
	}

	/**
	 * @dev Storage gap for future upgrades
	 * This reserves storage slots for adding new state variables in future contract upgrades
	 * without causing storage collisions. Current usage: 0/40 slots.
	 *
	 * IMPORTANT: When adding new state variables in upgrades:
	 * 1. Add the variable BEFORE the gap
	 * 2. Reduce gap size by the number of slots used (e.g., uint256[39] for 1 slot used)
	 */
	uint256[40] private __gap;
}
