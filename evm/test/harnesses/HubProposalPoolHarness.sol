  // SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubProposalPool} from "src/HubProposalPool.sol";

contract HubProposalPoolHarness is HubProposalPool {
  constructor(address _core, address _hubGovernor) HubProposalPool(_core, _hubGovernor) {}

  function exposed_extractAccountFromCalldata(bytes memory callData) public pure returns (address) {
    return _extractAccountFromCalldata(callData);
  }
}
