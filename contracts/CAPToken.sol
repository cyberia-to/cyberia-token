// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract CAPToken is
	Initializable,
	ERC20Upgradeable,
	ERC20PermitUpgradeable,
	ERC20VotesUpgradeable,
	OwnableUpgradeable,
	UUPSUpgradeable,
	ReentrancyGuardUpgradeable
{
	// Constants
	uint256 public constant BASIS_POINTS_DENOMINATOR = 10_000; // 100% = 10000 bp
	uint256 public constant MAX_TAX_BP = 500; // 5% per individual tax
	uint256 public constant MAX_COMBINED_TAX_BP = 800; // 8% combined cap for sell scenario (transfer + sell)
	uint256 public constant INITIAL_SUPPLY = 1_000_000_000 ether; // 1e9 * 1e18
	uint256 public constant MAX_SUPPLY = 10_000_000_000 ether; // 10B max supply cap (10x initial)
	uint256 public constant TAX_CHANGE_DELAY = 24 hours; // Timelock delay for tax changes

	// Tax parameters (in basis points)
	uint256 public transferTaxBp; // applied to non-pool <-> non-pool transfers and to sells in addition to sellTaxBp if desired (hybrid rule below)
	uint256 public sellTaxBp; // additional tax when user -> pool
	uint256 public buyTaxBp; // applied when pool -> user (set to 0 by default)

	// Pending tax changes (timelock)
	uint256 public pendingTransferTaxBp;
	uint256 public pendingSellTaxBp;
	uint256 public pendingBuyTaxBp;
	uint256 public taxChangeTimestamp; // When pending taxes can be applied

	address public feeRecipient; // zero address means burn mode (burns collected taxes)
	mapping(address => bool) public isPool; // AMM pair addresses

	// Events
	event PoolAdded(address indexed pool);
	event PoolRemoved(address indexed pool);
	event TaxChangeProposed(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp, uint256 effectiveTime);
	event TaxesUpdated(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp);
	event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
	event TaxBurned(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount);
	event TaxCollected(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount, address indexed recipient);
	event TokensMinted(address indexed to, uint256 amount);

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	/// @notice Initialize the token contract
	/// @param _owner The initial owner address (typically the DAO governance contract)
	/// @param _feeRecipient The fee recipient address. Use address(0) to enable burn mode where taxes are burned instead of collected
	function initialize(address _owner, address _feeRecipient) public initializer {
		__ERC20_init("Cyberia", "CAP");
		__ERC20Permit_init("Cyberia");
		__ERC20Votes_init();
		__Ownable_init(_owner);
		__UUPSUpgradeable_init();
		__ReentrancyGuard_init();

		// Default taxes per spec
		transferTaxBp = 100; // 1%
		sellTaxBp = 100; // 1%
		buyTaxBp = 0; // 0%

		feeRecipient = _feeRecipient; // recommended to be DAO safe; zero address enables burn mode

		// Initial supply to owner/treasury per spec
		_mint(_owner, INITIAL_SUPPLY);
	}

	// Admin functions
	/// @notice Propose new tax rates (requires timelock delay before applying)
	function proposeTaxChange(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp) external onlyOwner {
		require(_transferTaxBp <= MAX_TAX_BP, "TRANSFER_TAX_TOO_HIGH");
		require(_sellTaxBp <= MAX_TAX_BP, "SELL_TAX_TOO_HIGH");
		require(_buyTaxBp <= MAX_TAX_BP, "BUY_TAX_TOO_HIGH");
		// Combined cap: prevent total tax burden on sells from exceeding MAX_COMBINED_TAX_BP
		// Sells incur both transferTaxBp and sellTaxBp, so their sum must be capped
		require(_transferTaxBp + _sellTaxBp <= MAX_COMBINED_TAX_BP, "COMBINED_SELL_TAX_TOO_HIGH");

		pendingTransferTaxBp = _transferTaxBp;
		pendingSellTaxBp = _sellTaxBp;
		pendingBuyTaxBp = _buyTaxBp;
		taxChangeTimestamp = block.timestamp + TAX_CHANGE_DELAY;

		emit TaxChangeProposed(_transferTaxBp, _sellTaxBp, _buyTaxBp, taxChangeTimestamp);
	}

	/// @notice Apply pending tax changes after timelock delay
	function applyTaxChange() external onlyOwner {
		require(taxChangeTimestamp != 0, "NO_PENDING_CHANGE");
		require(block.timestamp >= taxChangeTimestamp, "TIMELOCK_NOT_EXPIRED");

		transferTaxBp = pendingTransferTaxBp;
		sellTaxBp = pendingSellTaxBp;
		buyTaxBp = pendingBuyTaxBp;

		// Reset pending state
		taxChangeTimestamp = 0;

		emit TaxesUpdated(transferTaxBp, sellTaxBp, buyTaxBp);
	}

	/// @notice Set taxes immediately (for initialization or emergency - use with caution)
	/// @dev This bypasses the timelock and should only be used during initial setup
	function setTaxesImmediate(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp) external onlyOwner {
		require(_transferTaxBp <= MAX_TAX_BP, "TRANSFER_TAX_TOO_HIGH");
		require(_sellTaxBp <= MAX_TAX_BP, "SELL_TAX_TOO_HIGH");
		require(_buyTaxBp <= MAX_TAX_BP, "BUY_TAX_TOO_HIGH");
		require(_transferTaxBp + _sellTaxBp <= MAX_COMBINED_TAX_BP, "COMBINED_SELL_TAX_TOO_HIGH");

		transferTaxBp = _transferTaxBp;
		sellTaxBp = _sellTaxBp;
		buyTaxBp = _buyTaxBp;
		emit TaxesUpdated(_transferTaxBp, _sellTaxBp, _buyTaxBp);
	}

	/// @notice Update the fee recipient address
	/// @param _feeRecipient The new fee recipient address. Use address(0) to enable burn mode where taxes are burned instead of collected
	function setFeeRecipient(address _feeRecipient) external onlyOwner {
		address oldRecipient = feeRecipient;
		feeRecipient = _feeRecipient; // zero address enables burn mode
		emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
	}

	function addPool(address pool) external onlyOwner {
		require(pool != address(0), "ZERO_ADDR");
		require(!isPool[pool], "EXISTS");
		isPool[pool] = true;
		emit PoolAdded(pool);
	}

	function removePool(address pool) external onlyOwner {
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

	/// @notice Mint new tokens - restricted to owner for future bridging/OFT needs
	/// @dev Only callable by owner (DAO governance). Uses canonical _mint() which emits Transfer(0x0, to, amount)
	/// @param to Address to receive minted tokens
	/// @param amount Amount of tokens to mint
	function mint(address to, uint256 amount) external onlyOwner {
		require(to != address(0), "MINT_TO_ZERO");
		require(totalSupply() + amount <= MAX_SUPPLY, "EXCEEDS_MAX_SUPPLY");
		_mint(to, amount);
		emit TokensMinted(to, amount);
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
	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

	// Required overrides for Solidity
	function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
		return super.nonces(owner);
	}

	function _maxSupply() internal pure override returns (uint256) {
		return type(uint224).max; // use Votes default
	}
}
