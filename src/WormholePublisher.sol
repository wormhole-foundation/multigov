// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

contract WormholePublisher {
  uint8 public publishConsistencyLevel;
  IWormhole public wormholeCore;

  event PublishConsistencyLevelUpdated(uint8 oldConsistency, uint8 newConsistency);
  event WormholeCoreUpdated(address oldCore, address newCore);

  constructor(address _core, uint8 _publishConsistencyLevel) {
    wormholeCore = IWormhole(_core);
    publishConsistencyLevel = _publishConsistencyLevel;
  }

  function _setPublishConsistencyLevel(uint8 _consistencyLevel) internal {
    publishConsistencyLevel = _consistencyLevel;
    emit PublishConsistencyLevelUpdated(publishConsistencyLevel, _consistencyLevel);
  }

  function _setWormholeCore(address _core) internal virtual {
    emit WormholeCoreUpdated(address(wormholeCore), _core);
    wormholeCore = IWormhole(_core);
  }
}
