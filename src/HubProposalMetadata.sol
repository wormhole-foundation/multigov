// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin-contracts/governance/IGovernor.sol";

contract HubProposalMetadata {
  IGovernor immutable governor;

  constructor(address _governor) {
    governor = IGovernor(_governor);
  }

  function getProposalMetadata(uint256 _proposalId) external view returns (uint256, uint256, uint256) {
    uint256 voteStart = governor.proposalSnapshot(_proposalId);
    uint256 voteEnd = governor.proposalDeadline(_proposalId);
    return (_proposalId, voteStart, voteEnd);
  }
}
