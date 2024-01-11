// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

interface IHubVotePool {
  error InvalidProposalVote();
  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  event SpokeVoteCast(
    uint16 indexed emitterChainId, uint256 proposalId, uint256 voteAgainst, uint256 voteFor, uint256 voteAbstain
  );

  function HUB_GOVERNOR() external view returns (address);
  function WORMHOLE_CORE() external view returns (address);
  function receiveMessage(bytes memory _encodedMessage) external;
}
