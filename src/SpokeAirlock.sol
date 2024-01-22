// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract SpokeAirlock {
  address public messageExecutor;

  error InvalidMessageExecutor();

  event MessageExecutorUpdated(address indexed newMessageExecutor);

  constructor(address _messageExecutor) {
    messageExecutor = _messageExecutor;
  }

  function _onlyMessageExecutor() internal view {
    if (msg.sender != messageExecutor) revert InvalidMessageExecutor();
  }

  function setMessageExecutor(address _messageExecutor) public {
    _onlyMessageExecutor();
    messageExecutor = _messageExecutor;
    emit MessageExecutorUpdated(_messageExecutor);
  }

  function executeOperations(address[] memory _targets, uint256[] memory _values, bytes[] memory _calldatas)
    external
    payable
  {
    _onlyMessageExecutor();
    for (uint256 i = 0; i < _targets.length; ++i) {
      // TODO: delegateCall?
      (bool success, bytes memory returndata) = _targets[i].call{value: _values[i]}(_calldatas[i]);
      Address.verifyCallResult(success, returndata);
    }
  }
}
