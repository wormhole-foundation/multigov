// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

contract HubProposalMetadata {
  IGovernor immutable GOVERNOR;

  constructor(address _governor) {
    GOVERNOR = IGovernor(_governor);
  }

  function getProposalMetadata(uint256 _proposalId) external view returns (uint256, uint256, uint256) {
    uint256 voteStart = GOVERNOR.proposalSnapshot(_proposalId);
    uint256 voteEnd = GOVERNOR.proposalDeadline(_proposalId);
    return (_proposalId, voteStart, voteEnd);
  }
}
