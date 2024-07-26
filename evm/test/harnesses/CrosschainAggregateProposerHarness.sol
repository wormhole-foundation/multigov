  // SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {CrossChainAggregateProposer} from "src/CrossChainAggregateProposer.sol";

contract CrossChainAggregateProposerHarness is CrossChainAggregateProposer {
  constructor(address _core, address _hubGovernor, uint48 _maxQueryTimestampOffset)
    CrossChainAggregateProposer(_core, _hubGovernor, _maxQueryTimestampOffset)
  {}

  function exposed_extractAccountFromCalldata(bytes memory callData) public pure returns (address) {
    return _extractAccountFromCalldata(callData);
  }
}
