// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

interface IVoteExtender {
  function extendedDeadlines(uint256 _proposalId) external view returns (uint48 _newVoteEnd);
  function MINIMUM_EXTENSION_DURATION() external view returns (uint48);
}
