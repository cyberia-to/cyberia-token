// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CAPTokenOFT
 * @notice LayerZero OFT implementation of CAP token for destination chains
 * @dev This contract represents CAP tokens on non-Ethereum chains (Arbitrum, Optimism, Base, Polygon, etc.)
 *
 * ## Architecture
 * - Deployed on each destination chain (Arbitrum, Optimism, Base, Polygon, etc.)
 * - Mints tokens when bridged FROM Ethereum (via OFTAdapter)
 * - Burns tokens when bridged TO Ethereum
 * - Standard ERC20 functionality with LayerZero cross-chain capabilities
 *
 * ## Key Differences from Ethereum CAP Token
 * 1. **No Taxes**: Destination chain tokens are tax-free for simple UX
 * 2. **No Governance**: Voting only on Ethereum where DAO exists
 * 3. **Mint/Burn**: Supply controlled by LayerZero bridge only
 * 4. **Simpler**: Clean ERC20 without complex tax logic
 *
 * ## Supply Management
 * - Total supply across ALL chains = Locked in adapter + Sum of all OFT supplies
 * - When user bridges TO destination: Adapter locks X, OFT mints X
 * - When user bridges FROM destination: OFT burns X, Adapter unlocks X
 * - Net result: Total supply stays constant (10B max)
 *
 * ## Security
 * - Uses official LayerZero OFT base contract
 * - Only LayerZero endpoint can trigger mint/burn (via _debit/_credit)
 * - Owner can configure cross-chain parameters
 * - Owner should be governance/DAO multisig on each chain
 *
 * ## Deployment
 * 1. Deploy CAPTokenOFT on destination chain
 * 2. Configure peer connection to Ethereum's OFTAdapter
 * 3. Set enforced options for gas limits
 * 4. Test with small amounts
 * 5. Transfer ownership to multisig
 *
 * @custom:security-contact security@cyberia.to
 */
contract CAPTokenOFT is OFT {
	/**
	 * @notice Initialize the OFT token
	 * @param _lzEndpoint The LayerZero V2 endpoint address for this chain
	 * @param _owner The owner address (should be governance/DAO multisig)
	 *
	 * LayerZero V2 Endpoints by Chain:
	 * - Arbitrum One: 0x1a44076050125825900e736c501f859c50fE728c
	 * - Arbitrum Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
	 * - Optimism: 0x1a44076050125825900e736c501f859c50fE728c
	 * - Optimism Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
	 * - Base: 0x1a44076050125825900e736c501f859c50fE728c
	 * - Base Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
	 * - Polygon: 0x1a44076050125825900e736c501f859c50fE728c
	 * - Polygon Amoy: 0x6EDCE65403992e310A62460808c4b910D972f10f
	 *
	 * @dev Token uses same name/symbol as Ethereum CAP token for consistency
	 * @dev Decimals are 18 to match Ethereum CAP token
	 */
	constructor(address _lzEndpoint, address _owner) OFT("Cyberia", "CAP", _lzEndpoint, _owner) Ownable(_owner) {}
}
