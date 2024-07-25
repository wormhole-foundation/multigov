  // SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {CrosschainAggregateProposer} from "src/CrosschainAggregateProposer.sol";

contract CrosschainAggregateProposerHarness is CrosschainAggregateProposer {
  constructor(address _core, address _hubGovernor) CrosschainAggregateProposer(_core, _hubGovernor) {}

  function exposed_extractAccountFromCalldata(bytes memory callData) public pure returns (address) {
    return _extractAccountFromCalldata(callData);
  }
}
