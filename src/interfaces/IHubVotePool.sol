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
  function spokeProposalVotes(bytes32 spokeProposalId)
    external
    view
    returns (uint128 againstVotes, uint128 forVotes, uint128 abstainVotes);
  function spokeRegistry(uint16 emitterChain) external view returns (bytes32 emitterAddress);
}
