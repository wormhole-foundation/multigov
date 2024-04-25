// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";

contract WormholeDispatcher is Ownable {
  uint8 public consistencyLevel;
  IWormhole public wormholeCore;

  event ConsistencyLevelUpdated(uint8 oldConsistencyLevel, uint8 newConsistencyLevel);
  event WormholeCoreUpdated(address oldCore, address newCore);

  constructor(address _owner, address _core, uint8 _consistencyLevel) Ownable(_owner) {
    wormholeCore = IWormhole(_core);
    consistencyLevel = _consistencyLevel;
  }

  function setConsistencyLevel(uint8 _consistencyLevel) external {
    _checkOwner();
    _setConsistencyLevel(_consistencyLevel);
  }

  function setWormholeCore(address _core) external {
    _checkOwner();
    _setWormholeCore(_core);
  }

  function _setConsistencyLevel(uint8 _consistencyLevel) internal {
    consistencyLevel = _consistencyLevel;
    emit ConsistencyLevelUpdated(consistencyLevel, _consistencyLevel);
  }

  function _setWormholeCore(address _core) internal virtual {
    emit WormholeCoreUpdated(address(wormholeCore), _core);
    wormholeCore = IWormhole(_core);
  }

  function _publishMessage(bytes memory _payload) internal returns (uint256 sequence) {
    sequence = wormholeCore.publishMessage(0, _payload, consistencyLevel);
  }
}
