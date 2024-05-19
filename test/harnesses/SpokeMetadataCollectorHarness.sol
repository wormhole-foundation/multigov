// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";

contract SpokeMetadataCollectorHarness is SpokeMetadataCollector {
  constructor(address _core, uint16 _hubChainId, address _hubGovernor)
    SpokeMetadataCollector(_core, _hubChainId, _hubGovernor)
  {}

  function workaround_createProposal(uint256 _proposalId, uint256 _voteStart, uint256 _voteEnd) public {
    proposals[_proposalId] = Proposal({voteStart: _voteStart});
  }

  function exposed_proposals(uint256 _proposalId) external view returns (Proposal memory) {
    return proposals[_proposalId];
  }
}
