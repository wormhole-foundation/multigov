// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

interface IMessageDispatcher {
  /// @notice Emitted when a message is dispatched.
  event MessageDispatched(uint256 indexed messageId, bytes payload);

  /// @notice Publishes a message to be sent to the appropriate spoke for cross chain execution.
  /// @param _payload The message payload to be sent
  function dispatch(bytes calldata _payload) external payable;
}
