// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockLayerZeroEndpoint
 * @notice Minimal mock of LayerZero V2 endpoint for testing
 * @dev This mock implements only the minimal interface needed for OFT contract deployment and basic testing
 */
contract MockLayerZeroEndpoint {
	// Structs from ILayerZeroEndpointV2
	struct MessagingParams {
		uint32 dstEid;
		bytes32 receiver;
		bytes message;
		bytes options;
		bool payInLzToken;
	}

	struct MessagingReceipt {
		bytes32 guid;
		uint64 nonce;
		MessagingFee fee;
	}

	struct MessagingFee {
		uint256 nativeFee;
		uint256 lzTokenFee;
	}

	struct Origin {
		uint32 srcEid;
		bytes32 sender;
		uint64 nonce;
	}

	// Events
	event PacketSent(bytes encodedPayload, bytes options, address sendLibrary);
	event PacketVerified(Origin origin, address receiver, bytes32 payloadHash);
	event PacketDelivered(Origin origin, address receiver);

	// State
	mapping(address => mapping(uint32 => bytes32)) public peers;
	uint64 public nonce;

	/**
	 * @notice Quote messaging fee
	 * @dev Returns zero fees for testing
	 */
	function quote(MessagingParams calldata, address) external pure returns (MessagingFee memory) {
		return MessagingFee({nativeFee: 0, lzTokenFee: 0});
	}

	/**
	 * @notice Send cross-chain message
	 * @dev Mock implementation that just emits event
	 */
	function send(MessagingParams calldata _params, address /*_refundAddress*/) external payable returns (MessagingReceipt memory) {
		nonce++;
		bytes32 guid = keccak256(abi.encodePacked(nonce, _params.dstEid, _params.receiver));

		emit PacketSent(_params.message, _params.options, address(this));

		return MessagingReceipt({guid: guid, nonce: nonce, fee: MessagingFee({nativeFee: 0, lzTokenFee: 0})});
	}

	/**
	 * @notice Set peer address for a destination endpoint
	 * @dev Used by OApp to configure trusted peers
	 */
	function setPeer(uint32 _eid, bytes32 _peer) external {
		peers[msg.sender][_eid] = _peer;
	}

	/**
	 * @notice Get peer address for a destination endpoint
	 */
	function getPeer(address _oapp, uint32 _eid) external view returns (bytes32) {
		return peers[_oapp][_eid];
	}

	/**
	 * @notice Check if origin is verifiable
	 * @dev Always returns true for testing
	 */
	function verifiable(Origin calldata, address) external pure returns (bool) {
		return true;
	}

	/**
	 * @notice Check if origin is initializable
	 * @dev Always returns true for testing
	 */
	function initializable(Origin calldata, address) external pure returns (bool) {
		return true;
	}

	/**
	 * @notice Verify a message
	 * @dev Mock implementation
	 */
	function verify(Origin calldata _origin, address _receiver, bytes32 _payloadHash) external {
		emit PacketVerified(_origin, _receiver, _payloadHash);
	}

	/**
	 * @notice Deliver a verified message
	 * @dev Mock implementation for testing
	 */
	function lzReceive(
		Origin calldata _origin,
		address _receiver,
		bytes32 /*_guid*/,
		bytes calldata _message,
		bytes calldata /*_extraData*/
	) external payable {
		emit PacketDelivered(_origin, _receiver);
		// In a real implementation, this would call _receiver.lzReceive()
		// For testing, we just emit the event
	}

	/**
	 * @notice Clear a message
	 * @dev Mock implementation
	 */
	function clear(address, Origin calldata, bytes32, bytes calldata) external pure {
		// No-op for testing
	}

	/**
	 * @notice Set delegate
	 * @dev Mock implementation
	 */
	function setDelegate(address) external pure {
		// No-op for testing
	}

	// IMessageLibManager interface (minimal implementation)
	function setDefaultSendLibrary(uint32, address) external pure {
		// No-op for testing
	}

	function setDefaultReceiveLibrary(uint32, address, uint256) external pure {
		// No-op for testing
	}

	function setDefaultReceiveLibraryTimeout(uint32, address, uint256) external pure {
		// No-op for testing
	}

	function isSupportedEid(uint32) external pure returns (bool) {
		return true;
	}

	function defaultSendLibrary(uint32) external pure returns (address) {
		return address(0);
	}

	function defaultReceiveLibrary(uint32) external pure returns (address) {
		return address(0);
	}

	function defaultReceiveLibraryTimeout(uint32) external pure returns (address, uint256) {
		return (address(0), 0);
	}

	function isValidReceiveLibrary(address, uint32, address) external pure returns (bool) {
		return true;
	}

	// IMessagingComposer interface (minimal implementation)
	function sendCompose(address, bytes32, uint16, bytes calldata) external pure {
		// No-op for testing
	}

	function lzCompose(address, address, bytes32, uint16, bytes calldata, bytes calldata) external payable {
		// No-op for testing
	}

	// IMessagingChannel interface (minimal implementation)
	function eid() external pure returns (uint32) {
		return 1; // Default to endpoint ID 1 for testing
	}

	// IMessagingContext interface (minimal implementation)
	function isSendingMessage() external pure returns (bool) {
		return false;
	}

	function getSendContext() external pure returns (uint32, address) {
		return (0, address(0));
	}
}
