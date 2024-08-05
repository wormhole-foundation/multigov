  // SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubEvmSpokeAggregateProposer} from "src/HubEvmSpokeAggregateProposer.sol";

contract HubEvmSpokeAggregateProposerHarness is HubEvmSpokeAggregateProposer {
  constructor(address _core, address _hubGovernor, uint48 _maxQueryTimestampOffset)
    HubEvmSpokeAggregateProposer(_core, _hubGovernor, _maxQueryTimestampOffset)
  {}

  function exposed_extractAccountFromCalldata(bytes memory callData) public pure returns (address) {
    return _extractAccountFromCalldata(callData);
  }
}
