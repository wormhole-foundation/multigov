// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {WormholeDispatcher} from "src/WormholeDispatcher.sol";

/// @title HubMessageDispatcher
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that will publish a message that can be relayed to the appropriate `SpokeExecutor`.
contract HubMessageDispatcher is WormholeDispatcher {
  /// @notice The id for the next message published.
  uint256 public nextMessageId = 1;

  /// @notice Thrown if the encoded payload is invalid.
  error InvalidSpokeExecutorOperationLength(uint256, uint256, uint256);

  /// @notice Emitted when a message is dispatched.
  event MessageDispatched(uint256 indexed proposalId, bytes payload);

  /// @param _timelock The timelock that will call the hub dispatcher to initiate a cross chain execution.
  /// @param _core The Wormhole contract that will handle publishing the cross chain message.
  /// @param _dispatchConsistencyLevel The consistency level of a message when sending it to another chain. In most
  /// situations this should be set to finalized.
  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  /// @notice Publishes a message to be sent to the appropriate spoke for cross chain execution.
  /// @param _payload An encoding of the target wormhole chain id and the cross chain calls that follow the same
  /// structure as Governor proposal: targets, values and calladata.
  function dispatch(bytes calldata _payload) external {
    _checkOwner();

    (uint16 wormholeChainId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
      abi.decode(_payload, (uint16, address[], uint256[], bytes[]));

    if (targets.length != values.length || targets.length != calldatas.length) {
      revert InvalidSpokeExecutorOperationLength(targets.length, values.length, calldatas.length);
    }

    bytes memory payload = abi.encode(nextMessageId, wormholeChainId, targets, values, calldatas);
    _publishMessage(payload);
    emit MessageDispatched(nextMessageId, payload);
    nextMessageId += 1;
  }
}
