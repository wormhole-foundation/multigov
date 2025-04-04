// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {WormholeDispatcher} from "src/WormholeDispatcher.sol";
import {IMessageDispatcher} from "src/interfaces/IMessageDispatcher.sol";

/// @title HubMessageDispatcher
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that will publish a message that can be relayed to the appropriate `SpokeExecutor`.
contract HubMessageDispatcher is WormholeDispatcher, IMessageDispatcher {
  /// @notice The id for the next message published.
  /// @dev This value is incremented after each successful message dispatch.
  uint256 public nextMessageId = 1;

  /// @notice Thrown if the encoded payload is invalid.
  error InvalidSpokeExecutorOperationLength(uint256 targetsLength, uint256 valuesLength, uint256 calldatasLength);

  /// @param _timelock The timelock that will call the hub dispatcher to initiate a cross chain execution.
  /// @param _core The Wormhole contract that will handle publishing the cross chain message.
  /// @param _dispatchConsistencyLevel The consistency level of a message when sending it to another chain. In most
  /// situations this should be set to finalized.
  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  /// @notice Publishes a message to be sent to the appropriate spoke for cross chain execution.
  /// @param _payload An encoding of the target wormhole chain id and the cross chain calls that follow the same
  /// structure as Governor proposal: targets, values, and calldata.
  function dispatch(bytes calldata _payload) external payable {
    _checkOwner();

    (uint16 _wormholeChainId, address[] memory _targets, uint256[] memory _values, bytes[] memory _calldatas) =
      abi.decode(_payload, (uint16, address[], uint256[], bytes[]));

    if (_targets.length != _values.length || _targets.length != _calldatas.length) {
      revert InvalidSpokeExecutorOperationLength(_targets.length, _values.length, _calldatas.length);
    }

    bytes memory payload = abi.encode(nextMessageId, _wormholeChainId, _targets, _values, _calldatas);
    _publishMessage(payload, msg.value);
    emit MessageDispatched(nextMessageId, payload);
    nextMessageId++;
  }
}
