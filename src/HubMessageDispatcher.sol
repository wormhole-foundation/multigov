// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

import {WormholePublisher} from "src/WormholePublisher.sol";

contract HubMessageDispatcher is WormholePublisher {
  address public timelock;

  error InvalidTimelock();

  event MessageDispatched(bytes payload);
  event TimelockUpdated(address oldTimelock, address newTimelock);

  constructor(address _timelock, address _core, uint8 _publishConsistencyLevel) WormholePublisher(_core, _publishConsistencyLevel) {
    timelock = _timelock;
  }

  // TODO: There may be opportunities for space optimization
  function dispatch(bytes calldata _payload) external {
    _onlyTimelock();
    wormholeCore.publishMessage(
      0, // TODO nonce: needed?
      _payload, // payload
      publishConsistencyLevel
    );
    emit MessageDispatched(_payload);
  }

  function setPublishConsistencyLevel(uint8 _consistencyLevel) external {
    _onlyTimelock();
	_setPublishConsistencyLevel(_consistencyLevel);
  }

  function setWormholeCore(address _core) external {
    _onlyTimelock();
	_setWormholeCore(_core);
  }

  function setTimelock(address _timelock) external {
    _onlyTimelock();
    emit TimelockUpdated(timelock, _timelock);
    timelock = _timelock;
  }

  function _onlyTimelock() internal view {
    if (msg.sender != timelock) revert InvalidTimelock();
  }
}
