// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

interface ISpokeAirlock {
  error FailedInnerCall();
  error InvalidMessageExecutor();

  event MessageExecutorUpdated(address indexed newMessageExecutor);

  function executeOperations(address[] memory _targets, uint256[] memory _values, bytes[] memory _calldatas)
    external
    payable;
  function messageExecutor() external view returns (address);
  function setMessageExecutor(address _messageExecutor) external;
}
