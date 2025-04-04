// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";

contract SpokeVoteAggregatorHarness is SpokeVoteAggregator {
  constructor(address _spokeMetadataCollector, address _votingToken, address _owner, uint48 _voteWeightWindow)
    SpokeVoteAggregator(_spokeMetadataCollector, _votingToken, _owner, _voteWeightWindow)
  {}

  function exposed_hashTypedDataV4(bytes32 structHash) external view returns (bytes32) {
    return _hashTypedDataV4(structHash);
  }
}
