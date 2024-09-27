  // SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubEvmSpokeAggregateProposer} from "src/HubEvmSpokeAggregateProposer.sol";

contract HubEvmSpokeAggregateProposerHarness is HubEvmSpokeAggregateProposer {
  constructor(address _core, address _hubGovernor, address _spokeRegistry, uint48 _maxQueryTimestampOffset)
    HubEvmSpokeAggregateProposer(_core, _hubGovernor, _spokeRegistry, _maxQueryTimestampOffset)
  {}

  function exposed_extractAccountFromCalldata(bytes memory callData) public pure returns (address, uint256) {
    return _extractAccountFromCalldata(callData);
  }
}
