// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

contract HubProposalMetadata {
  IGovernor public immutable GOVERNOR;

  constructor(address _governor) {
    GOVERNOR = IGovernor(_governor);
  }

  function getProposalMetadata(uint256 _proposalId) external view returns (uint256, uint256) {
    uint256 voteStart = GOVERNOR.proposalSnapshot(_proposalId);
    return (_proposalId, voteStart);
  }
}
