// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

/// @title HubProposalMetadata
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that composes together necessary proposal metadata to be read in a single call.
contract HubProposalMetadata {
  /// @notice The governor contract where proposal data will be read.
  IGovernor public immutable GOVERNOR;

  /// @param _governor The address of the governor contract where metadata will be read.
  constructor(address _governor) {
    GOVERNOR = IGovernor(_governor);
  }

  /// @notice A method to read both proposal id and proposal vote start. This is meant to be read using
  /// Wormhole Queries when setting up a proposal to be voted on a spoke.
  /// @param _proposalId The proposal id from which to read metadata.
  /// @return The proposal id and the vote start.
  function getProposalMetadata(uint256 _proposalId) external view returns (uint256, uint256) {
    uint256 _voteStart = GOVERNOR.proposalSnapshot(_proposalId);
    return (_proposalId, _voteStart);
  }
}
