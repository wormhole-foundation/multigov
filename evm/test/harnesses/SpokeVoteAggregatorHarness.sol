// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";

contract SpokeVoteAggregatorHarness is SpokeVoteAggregator {
  constructor(
    address _spokeMetadataCollector,
    address _votingToken,
    uint32 _safeWindow,
    address _owner,
    uint48 _voteWeightWindow
  ) SpokeVoteAggregator(_spokeMetadataCollector, _votingToken, _safeWindow, _owner, _voteWeightWindow) {}

  function exposed_setSafeWindow(uint48 _safeWindow) public {
    _setSafeWindow(_safeWindow);
  }
}
