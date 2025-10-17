// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Mock DEX pair for testing purposes
/// @dev Simulates a Uniswap V2/V3/V4 style pair with token0() and token1() functions
contract MockDEXPair {
	address public token0;
	address public token1;

	constructor(address _token0, address _token1) {
		token0 = _token0;
		token1 = _token1;
	}
}
