// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {UUPSUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";

/// @title SpokeMessageExecutor
/// @notice A contract that executes messages from a hub chain on a spoke chain.
/// @dev This contract verifies and processes Wormhole messages, executing the encoded operations through a
/// SpokeAirlock.
contract SpokeMessageExecutor is UUPSUpgradeable {
  // keccak256(abi.encode(uint256(keccak256("multigov.storage.SpokeMessageExecutor")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant SPOKE_MESSAGE_EXECUTOR_STORAGE_LOCATION =
    0x9cd702a23e48a2c7d64fcb36b1c29497b466db76f16bb425b36f7a6277814900;

  /// @notice The address of the contract deployer
  address public immutable deployer;

  /// @notice Thrown if the executor has already been initialized.
  error AlreadyInitialized();
  /// @notice Thrown if a message has already been executed.
  error AlreadyProcessedMessage();
  /// @notice Thrown if a function caller does not have permission to be a caller.
  error InvalidCaller();
  /// @notice Thrown if the spoke airlock is currently the zero address.
  error InvalidSpokeAirlock();
  /// @notice Thrown if a cross chain message has an invalid encoding.
  error InvalidSpokeExecutorOperationLength(uint256 targetsLength, uint256 valuesLength, uint256 calldatasLength);
  /// @notice Thrown if a parsed message is an invalid message.
  error InvalidWormholeMessage(string reason);
  /// @notice Thrown if the message publisher is an unknown emitter.
  error UnknownMessageEmitter();
  /// @notice Thrown if the caller is not the deployer.
  error OnlyDeployer();

  /// @custom:storage-location erc7201:multigov.storage.SpokeMessageExecutor
  struct SpokeMessageExecutorStorage {
    /// @notice The hub contract that publishes the message to be consumed by the spoke executor.
    bytes32 _hubDispatcher;
    /// @notice The hub chain id where a message will be dispatched.
    uint16 _hubChainId;
    /// @notice The wormhole id of the current spoke.
    uint16 _spokeChainId;
    /// @notice The wormhole contract that will handle parsing an encoded cross chain message.
    IWormhole _wormholeCore;
    /// @notice An account that will execute the cross chain proposal.
    SpokeAirlock _airlock;
    /// @notice A mapping of message hashes to execution status. The status should always be true because pending
    /// messages
    /// are not stored.
    mapping(bytes32 messageHash => bool executed) _messageReceived;
  }

  /// @notice Emitted when the hub dispatcher is updated.
  event HubDispatcherUpdated(bytes32 oldHubDispatcher, bytes32 newHubDispatcher);

  /// @notice Emitted when a spoke proposal is executed.
  event ProposalExecuted(uint16 emitterChainId, bytes32 emitterAddress, uint256 proposalId);

  constructor() {
    deployer = msg.sender;
    _disableInitializers();
  }

  function _getSpokeMessageExecutorStorage() private pure returns (SpokeMessageExecutorStorage storage $) {
    assembly {
      $.slot := SPOKE_MESSAGE_EXECUTOR_STORAGE_LOCATION
    }
  }

  /// @notice Sets the initial airlock on the spoke message executor.
  function initialize(bytes32 _hubDispatcher, uint16 _hubChainId, address _wormholeCore) public initializer {
    if (msg.sender != deployer) revert OnlyDeployer();

    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    $._hubDispatcher = _hubDispatcher;
    $._hubChainId = _hubChainId;
    $._spokeChainId = IWormhole(_wormholeCore).chainId();
    $._wormholeCore = IWormhole(_wormholeCore);
    $._airlock = new SpokeAirlock(address(this));
  }

  function airlock() external returns (SpokeAirlock) {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    return $._airlock;
  }

  function hubChainId() external returns (uint16) {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    return $._hubChainId;
  }

  function hubDispatcher() external returns (bytes32) {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    return $._hubDispatcher;
  }

  function messageReceived(bytes32 _hash) external returns (bool) {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    return $._messageReceived[_hash];
  }

  function spokeChainId() external returns (uint16) {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    return $._spokeChainId;
  }

  function wormholeCore() external returns (IWormhole) {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    return $._wormholeCore;
  }

  function setHubDispatcher(bytes32 _newHubDispatcher) external {
    _onlyAirlock();
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    emit HubDispatcherUpdated($._hubDispatcher, _newHubDispatcher);
    $._hubDispatcher = _newHubDispatcher;
  }

  /// @notice A function that takes in an encoded proposal message that is meant to be executed on the spoke. There are
  /// no deadlines for these messages and can be replayed until they succeed. It is recommend to encode calls that have
  /// some expiry.
  /// @param _encodedMessage The encoded message id, wormhole chain id, targets, values, and calldatas.
  function receiveMessage(bytes memory _encodedMessage) external payable {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory _wormholeMessage, bool _valid, string memory _reason) =
      $._wormholeCore.parseAndVerifyVM(_encodedMessage);

    if (!_valid) revert InvalidWormholeMessage(_reason);
    if ($._messageReceived[_wormholeMessage.hash]) revert AlreadyProcessedMessage();

    if (_wormholeMessage.emitterAddress != $._hubDispatcher || _wormholeMessage.emitterChainId != $._hubChainId) {
      revert UnknownMessageEmitter();
    }

    (
      uint256 _messageId,
      uint16 _wormholeChainId,
      address[] memory _targets,
      uint256[] memory _values,
      bytes[] memory _calldatas
    ) = abi.decode(_wormholeMessage.payload, (uint256, uint16, address[], uint256[], bytes[]));

    if (_targets.length != _values.length || _targets.length != _calldatas.length) {
      revert InvalidSpokeExecutorOperationLength(_targets.length, _values.length, _calldatas.length);
    }

    _validateChainId(_wormholeChainId);

    $._messageReceived[_wormholeMessage.hash] = true;
    $._airlock.executeOperations(_targets, _values, _calldatas);
    emit ProposalExecuted(_wormholeMessage.emitterChainId, _wormholeMessage.emitterAddress, _messageId);
  }

  /// @notice A function that updates the spoke airlock to a new address.
  /// @param _newAirlock The address of the new airlock.
  function setAirlock(address payable _newAirlock) external {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    _onlyAirlock();
    if (address(_newAirlock) == address(0)) revert InvalidSpokeAirlock();
    $._airlock = SpokeAirlock(_newAirlock);
  }

  /// @notice A function that reverts if the caller is not the spoke.
  function _onlyAirlock() internal view {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    if (msg.sender != address($._airlock)) revert InvalidCaller();
  }

  /// @notice A function to verify the message was meant for this spoke chain.
  /// @param _messageChainId The wormhole message chain id.
  function _validateChainId(uint16 _messageChainId) internal view {
    SpokeMessageExecutorStorage storage $ = _getSpokeMessageExecutorStorage();
    if ($._spokeChainId != _messageChainId) revert InvalidWormholeMessage("Message is not meant for this chain.");
  }

  function _authorizeUpgrade(address /* newImplementation */ ) internal view override {
    _onlyAirlock();
  }
}
