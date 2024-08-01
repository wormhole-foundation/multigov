// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

// @title SpokeAirlock
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that executes cross chain proposals in the `SpokeMessageExecutor`. It is meant to function as a
/// spoke account for the DAO, and to create a simple upgrade path for the `SpokeMessageExecutor`.
contract SpokeAirlock {
  /// @notice The address of the only contract that can execute cross chain proposals using the `SpokeAirlock`.
  address public messageExecutor;

  /// @notice Thrown when the caller of a method is not the message executor.
  error InvalidMessageExecutor();

  /// @notice Emitted when the message executor is changed to a new address.
  event MessageExecutorUpdated(address indexed newMessageExecutor);

  /// @notice _messageExecutor The address of the contract that will be the message executor.
  constructor(address _messageExecutor) {
    messageExecutor = _messageExecutor;
  }

  /// @notice Since the airlock is a spoke account there may be a situation where it needs to be funded with native
  /// tokens.
  receive() external payable {}

  /// @notice A method to check that `msg.sender` is the message executor.
  function _onlyMessageExecutor() internal view {
    if (msg.sender != messageExecutor) revert InvalidMessageExecutor();
  }

  /// @notice Updates the message executor to a new address.
  /// @param _messageExecutor The address of the new message executor.
  function setMessageExecutor(address _messageExecutor) public {
    _onlyMessageExecutor();
    messageExecutor = _messageExecutor;
    emit MessageExecutorUpdated(_messageExecutor);
  }

  /// @notice A method to execute cross chain proposals. This method can only be called by the message executor.
  /// @param _targets A list of contracts to call when a proposal is executed.
  /// @param _values A list of values to send when calling each target.
  /// @param _calldatas A list of calldatas to use when calling the targets.
  function executeOperations(address[] memory _targets, uint256[] memory _values, bytes[] memory _calldatas)
    external
    payable
  {
    _onlyMessageExecutor();
    for (uint256 i = 0; i < _targets.length; ++i) {
      (bool _success, bytes memory _returndata) = _targets[i].call{value: _values[i]}(_calldatas[i]);
      Address.verifyCallResult(_success, _returndata);
    }
  }
}
