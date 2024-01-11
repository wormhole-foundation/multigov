// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface ISpokeVoteAggregator {
  type ProposalState is uint8;

  struct Proposal {
    uint256 voteStart;
    uint256 voteEnd;
    bool isCanceled;
  }

  error InvalidAccountNonce(address account, uint256 currentNonce);
  error InvalidShortString();
  error InvalidSignature(address voter);
  error InvalidVoteType();
  error InvalidWormholeMessage(string);
  error NoWeight();
  error ProposalInactive();
  error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
  error StringTooLong(string str);
  error UnknownMessageEmitter();

  event EIP712DomainChanged();
  event ProposalCanceled(uint256 proposalId);
  event ProposalCreated(uint256 proposalId, uint256 startBlock, uint256 endBlock);
  event VoteBridged(uint256 indexed proposalId, uint256 voteAgainst, uint256 voteFor, uint256 voteAbstain);
  event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);

  function BALLOT_TYPEHASH() external view returns (bytes32);
  function CAST_VOTE_WINDOW() external view returns (uint32);
  function HUB_CHAIN_ID() external view returns (uint16);
  function HUB_PROPOSAL_METADATA_SENDER() external view returns (bytes32);
  function VOTING_TOKEN() external view returns (address);
  function WORMHOLE_CORE() external view returns (address);
  function bridgeVote(uint256 _proposalId) external payable;
  function castVote(uint256 proposalId, uint8 support) external returns (uint256);
  function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes memory signature)
    external
    returns (uint256);
  function castVoteWithReason(uint256 proposalId, uint8 support, string memory reason) external returns (uint256);
  function eip712Domain()
    external
    view
    returns (
      bytes1 fields,
      string memory name,
      string memory version,
      uint256 chainId,
      address verifyingContract,
      bytes32 salt,
      uint256[] memory extensions
    );
  function getProposal(uint256 proposalId) external view returns (Proposal memory);
  function internalVotingPeriodEnd(uint256 _proposalId) external view returns (uint256 _lastVotingBlock);
  function nonces(address owner) external view returns (uint256);
  function proposalVotes(uint256 proposalId)
    external
    view
    returns (uint128 againstVotes, uint128 forVotes, uint128 abstainVotes);
  function receiveMessage(bytes memory _encodedMessage) external;
  function state(uint256 proposalId) external view returns (ProposalState);
  function voteActiveHub(uint256 proposalId) external view returns (bool active);
  function voteActiveInternal(uint256 proposalId) external view returns (bool active);
}
