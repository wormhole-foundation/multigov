// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

contract HubMessageDispatcher {
  uint8 public publishConsistencyLevel;
  IWormhole public wormholeCore;
  address public timelock;

  error InvalidTimelock();

  event MessageDispatched(bytes payload);
  event PublishConsistencyLevelUpdated(uint8 oldConsistency, uint8 newConsistency);
  event WormholeCoreUpdated(address oldCore, address newCore);
  event TimelockUpdated(address oldTimelock, address newTimelock);

  constructor(address _timelock, address _core, uint8 _publishConsistencyLevel) {
    timelock = _timelock;
    wormholeCore = IWormhole(_core);
    publishConsistencyLevel = _publishConsistencyLevel;
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
    publishConsistencyLevel = _consistencyLevel;
    emit PublishConsistencyLevelUpdated(publishConsistencyLevel, _consistencyLevel);
  }

  function setWormholeCore(address _core) external {
    _onlyTimelock();
    emit WormholeCoreUpdated(address(wormholeCore), _core);
    wormholeCore = IWormhole(_core);
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
