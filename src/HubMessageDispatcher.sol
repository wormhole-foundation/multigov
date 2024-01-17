// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract HubMessageDispatcher {
  address public timelock;

  event MessageDispatched(uint256 _chainsBitField, address[] _targets, uint256[] _values, bytes[] calldatas);

  event TimelockUpdated(address oldTimelock, address newTimelock);

  constructor(address _timelock) {
    timelock = _timelock;
  }

  // TODO: There may be opportunities for space optimization
  function dispatch(
    uint256 _chainsBitField,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory calldatas
  ) external {
    _onlyTimelock();
    // publish message to WORMHOLE_CORE
  }

  function setTimelock(address _timelock) public {
    _onlyTimelock();
  }

  function _onlyTimelock() internal {}
}
