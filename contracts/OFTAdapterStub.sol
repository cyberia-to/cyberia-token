// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface IOFTAdapterHook {
	function onOFTReceived(address from, uint256 amount, bytes calldata data) external;
}

contract OFTAdapterStub is Initializable, OwnableUpgradeable, UUPSUpgradeable, IOFTAdapterHook {
	event OFTReceived(address indexed from, uint256 amount, bytes data);

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() { _disableInitializers(); }

	function initialize(address owner_) public initializer {
		__Ownable_init(owner_);
		__UUPSUpgradeable_init();
	}

	function onOFTReceived(address from, uint256 amount, bytes calldata data) external override {
		// no-op for now; just emit for observability
		emit OFTReceived(from, amount, data);
	}

	// UUPS authorization
	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

