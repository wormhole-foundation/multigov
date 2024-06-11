// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubVotePool} from "src/HubVotePool.sol";

contract HubVotePoolHarness is HubVotePool {
  constructor(
    address _core,
    address _hubGovernor,
    SpokeVoteAggregator[] memory _initialSpokeRegistry,
    uint32 _safeWindow
  ) HubVotePool(_core, _hubGovernor, _initialSpokeRegistry, _safeWindow) {}

  function exposed_setSafeWindow(uint48 _safeWindow) external {
    return _setSafeWindow(_safeWindow);
  }
}
