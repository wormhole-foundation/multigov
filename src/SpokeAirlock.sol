// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract SpokeAirlock {
  address public messageExecutor;

  constructor(address _messageExecutor) {
    messageExecutor = _messageExecutor;
  }

  function setMessageExecutor(address _messageExecutor) public {
    _onlyMessageExecutor();
    messageExecutor = _messageExecutor;
  }

  function _onlyMessageExecutor() internal {}

  function executeOperations(address[] memory _targets, uint256[] memory _values, bytes[] memory _calldatas) external {
    _onlyMessageExecutor();
    _executeOperations(0, _targets, _values, _calldatas, bytes32(0));
  }

  function _executeOperations(
    uint256, /* proposalId */
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 /*descriptionHash*/
  ) internal {
    for (uint256 i = 0; i < targets.length; ++i) {
      // if(!targets[i] == address(bytes20("executor"))) {
      //   continue;
      // }
      // TODO: delegateCall?
      (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
      Address.verifyCallResult(success, returndata);
    }
  }
}
