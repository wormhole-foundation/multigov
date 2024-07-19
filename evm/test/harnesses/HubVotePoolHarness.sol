// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubVotePool} from "src/HubVotePool.sol";

contract HubVotePoolHarness is HubVotePool {
  constructor(address _core, address _hubGovernor, SpokeVoteAggregator[] memory _initialSpokeRegistry)
    HubVotePool(_core, _hubGovernor, _initialSpokeRegistry)
  {}
}
