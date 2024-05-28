// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";

contract SpokeVoteAggregatorHarness is SpokeVoteAggregator {
  constructor(address _spokeMetadataCollector, address _votingToken, uint32 _safeWindow, address _owner)
    SpokeVoteAggregator(_spokeMetadataCollector, _votingToken, _safeWindow, _owner)
  {}

  function exposed_setSafeWindow(uint32 _safeWindow) public {
    _setSafeWindow(_safeWindow);
  }
}
