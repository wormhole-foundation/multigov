// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";

contract SpokeMessageExecutor {
  /// @notice The hub contract that publishes the message to be consumed by the spoke executor.
  bytes32 public immutable HUB_DISPATCHER;
  /// @notice The hub chain id where a message will be dispatched.
  uint16 public immutable HUB_CHAIN_ID;
  /// @notice The wormhole id of the current spoke.
  uint16 public immutable SPOKE_CHAIN_ID;
  /// @notice  The wormhole contract that will handle parsing an encoded cross chain message.
  IWormhole public immutable WORMHOLE_CORE;
  /// @notice An account that will execute the cross chain proposal.
  SpokeAirlock public airlock;
  /// @notice An indicator of whether the initial spoke airlock has been set on the executor.
  bool public initialized = false;

  /// @notice Thrown if the executor has already been initialized.
  error AlreadyInitialized();
  /// @notice Thrown if a message has already been executed.
  error AlreadyProcessedMessage();
  /// @notice Thrown if a function caller does not have permission to be a caller.
  error InvalidCaller();
  /// @notice Thrown if a cross chain message has an invalid encoding.
  error InvalidSpokeExecutorOperationLength(uint256 targetsLength, uint256 valuesLength, uint256 calldatasLength);
  /// @notice Thrown if a parsed message is an invalid message.
  error InvalidWormholeMessage(string reason);
  /// @notice Thrown if the message publisher is an unknown emitter.
  error UnknownMessageEmitter();

  /// @notice Emitted when a spoke proposal is executed.
  event ProposalExecuted(uint16 emitterChainId, bytes32 emitterAddress, uint256 proposalId);

  /// @notice A mapping of message hashes to execution status. The status should always be true because pending messages
  /// are not stored.
  mapping(bytes32 messageHash => bool executed) public messageReceived;

  /// @param _hubDispatcher The contract where the message is published.
  /// @param _hubChainId The wormhole chain where the message is published.
  /// @param _wormholeCore The wormhole core contract that handles message parsing.
  /// @param _spokeChainId The wormhole chain id of the spoke where the messages are executed.
  constructor(bytes32 _hubDispatcher, uint16 _hubChainId, IWormhole _wormholeCore, uint16 _spokeChainId) {
    HUB_DISPATCHER = _hubDispatcher;
    HUB_CHAIN_ID = _hubChainId;
    WORMHOLE_CORE = _wormholeCore;
    SPOKE_CHAIN_ID = _spokeChainId;
  }

  /// @notice Sets the initial airlock on the spoke message executor.
  /// @param _airlock The address for the initial airlock.
  function initialize(address payable _airlock) external {
    if (initialized) revert AlreadyInitialized();
    airlock = SpokeAirlock(_airlock);
    initialized = true;
  }

  /// @notice A function that takes in an encoded proposal messagge that is meant to be executed on the spoke. There are
  /// no deadlines for these messages and can be replayed until they succeed. It is recommend to encode calls that have
  /// some expiry.
  /// @param _encodedMessage The encoded message id, wormhole chain id, targets, values, and calldatas.
  function receiveMessage(bytes memory _encodedMessage) external payable {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);

    if (!valid) revert InvalidWormholeMessage(reason);
    if (messageReceived[wormholeMessage.hash]) revert AlreadyProcessedMessage();

    if (wormholeMessage.emitterAddress != HUB_DISPATCHER || wormholeMessage.emitterChainId != HUB_CHAIN_ID) {
      revert UnknownMessageEmitter();
    }

    (
      uint256 _messageId,
      uint16 _wormholeChainId,
      address[] memory _targets,
      uint256[] memory _values,
      bytes[] memory _calldatas
    ) = abi.decode(wormholeMessage.payload, (uint256, uint16, address[], uint256[], bytes[]));

    if (_targets.length != _values.length || _targets.length != _calldatas.length) {
      revert InvalidSpokeExecutorOperationLength(_targets.length, _values.length, _calldatas.length);
    }

    _validateChainId(_wormholeChainId);

    airlock.executeOperations(_targets, _values, _calldatas);
    messageReceived[wormholeMessage.hash] = true;
    emit ProposalExecuted(wormholeMessage.emitterChainId, wormholeMessage.emitterAddress, _messageId);
  }

  /// @notice A function that updates the spoke airlock to a new address.
  /// @param _newAirlock The address of the new airlock.
  function setAirlock(address payable _newAirlock) external {
    _onlyAirlock();
    airlock = SpokeAirlock(_newAirlock);
  }

  /// @notice A function that reverts if the caller is not the spoke.
  function _onlyAirlock() internal view {
    if (msg.sender != address(airlock)) revert InvalidCaller();
  }

  /// @notice A funciton to verify the message was meant for this spoke chain.
  /// @param _messageChainId The wormhole message chain id.
  function _validateChainId(uint16 _messageChainId) internal view {
    if (SPOKE_CHAIN_ID != _messageChainId) revert InvalidWormholeMessage("Message is not meant for this chain.");
  }
}
