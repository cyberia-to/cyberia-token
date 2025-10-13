// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract CAPToken is Initializable, ERC20Upgradeable, ERC20PermitUpgradeable, ERC20VotesUpgradeable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
	// Constants
	uint256 public constant BASIS_POINTS_DENOMINATOR = 10_000; // 100% = 10000 bp
	uint256 public constant MAX_TAX_BP = 500; // 5%
	uint256 public constant INITIAL_SUPPLY = 1_000_000_000 ether; // 1e9 * 1e18

	// Tax parameters (in basis points)
	uint256 public transferTaxBp; // applied to non-pool <-> non-pool transfers and to sells in addition to sellTaxBp if desired (hybrid rule below)
	uint256 public sellTaxBp; // additional tax when user -> pool
	uint256 public buyTaxBp; // applied when pool -> user (set to 0 by default)

	address public feeRecipient; // zero address means burn via _burn
	mapping(address => bool) public isPool; // AMM pair addresses

	// Events
	event PoolAdded(address indexed pool);
	event PoolRemoved(address indexed pool);
	event TaxesUpdated(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp);
	event FeeRecipientUpdated(address indexed newRecipient);
	event TaxApplied(address indexed from, address indexed to, uint256 grossAmount, uint256 taxAmount, bool burned);

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() { _disableInitializers(); }

	function initialize(address _owner, address _feeRecipient) public initializer {
		__ERC20_init("Cyberia", "CAP");
		__ERC20Permit_init("Cyberia");
		__ERC20Votes_init();
		__Ownable_init(_owner);
		__Pausable_init();
		__UUPSUpgradeable_init();

		// Default taxes per spec
		transferTaxBp = 100; // 1%
		sellTaxBp = 100; // 1%
		buyTaxBp = 0; // 0%

		feeRecipient = _feeRecipient; // recommended to be DAO safe; zero burns

		// Initial supply to owner/treasury per spec
		_mint(_owner, INITIAL_SUPPLY);
	}

	// Admin functions
	function setTaxes(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp) external onlyOwner {
		require(_transferTaxBp <= MAX_TAX_BP, "TRANSFER_TAX_TOO_HIGH");
		require(_sellTaxBp <= MAX_TAX_BP, "SELL_TAX_TOO_HIGH");
		require(_buyTaxBp <= MAX_TAX_BP, "BUY_TAX_TOO_HIGH");
		transferTaxBp = _transferTaxBp;
		sellTaxBp = _sellTaxBp;
		buyTaxBp = _buyTaxBp;
		emit TaxesUpdated(_transferTaxBp, _sellTaxBp, _buyTaxBp);
	}

	function setFeeRecipient(address _feeRecipient) external onlyOwner {
		feeRecipient = _feeRecipient; // zero address => burn
		emit FeeRecipientUpdated(_feeRecipient);
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

	// Emergency pause functions for legal compliance
	function pause() external onlyOwner {
		_pause();
	}

	function unpause() external onlyOwner {
		_unpause();
	}

	// Burn per ERC20Burnable semantics (external function that calls internal _burn)
	function burn(uint256 amount) external {
		_burn(_msgSender(), amount);
	}

	function burnFrom(address account, uint256 amount) external {
		_spendAllowance(account, _msgSender(), amount);
		_burn(account, amount);
	}

	// Internal tax logic applied on transfers
	function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) whenNotPaused {
		// No tax on mints/burns
		if (from == address(0) || to == address(0)) {
			super._update(from, to, value);
			return;
		}

		uint256 taxBp = 0;
		bool toIsPool = isPool[to];
		bool fromIsPool = isPool[from];

		if (fromIsPool && !toIsPool) {
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
				// Burn path: reduce supply and emit Transfer(from, 0x0, taxAmount)
				_burn(from, taxAmount);
				emit TaxApplied(from, to, value, taxAmount, true);
			} else {
				// Transfer fee to recipient
				super._update(from, feeRecipient, taxAmount);
				emit TaxApplied(from, to, value, taxAmount, false);
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

