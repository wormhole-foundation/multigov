// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {WormholeDispatcher} from "src/WormholeDispatcher.sol";

contract HubMessageDispatcher is WormholeDispatcher {
  event MessageDispatched(bytes payload);

  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  // TODO: There may be opportunities for space optimization
  function dispatch(bytes calldata _payload) external {
    _checkOwner();
    _publishMessage(_payload);
    emit MessageDispatched(_payload);
  }
}
