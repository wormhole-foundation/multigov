// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface IWormholeGovernor {
  type ProposalState is uint8;

  error FailedInnerCall();
  error GovernorAlreadyCastVote(address voter);
  error GovernorAlreadyQueuedProposal(uint256 proposalId);
  error GovernorDisabledDeposit();
  error GovernorInsufficientProposerVotes(address proposer, uint256 votes, uint256 threshold);
  error GovernorInvalidProposalLength(uint256 targets, uint256 calldatas, uint256 values);
  error GovernorInvalidSignature(address voter);
  error GovernorInvalidVoteType();
  error GovernorInvalidVotingPeriod(uint256 votingPeriod);
  error GovernorNonexistentProposal(uint256 proposalId);
  error GovernorNotQueuedProposal(uint256 proposalId);
  error GovernorOnlyExecutor(address account);
  error GovernorOnlyProposer(address account);
  error GovernorQueueNotImplemented();
  error GovernorRestrictedProposer(address proposer);
  error GovernorUnexpectedProposalState(uint256 proposalId, ProposalState current, bytes32 expectedStates);
  error InvalidAccountNonce(address account, uint256 currentNonce);
  error InvalidShortString();
  error QueueEmpty();
  error QueueFull();
  error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
  error StringTooLong(string str);

  event EIP712DomainChanged();
  event ProposalCanceled(uint256 proposalId);
  event ProposalCreated(
    uint256 proposalId,
    address proposer,
    address[] targets,
    uint256[] values,
    string[] signatures,
    bytes[] calldatas,
    uint256 voteStart,
    uint256 voteEnd,
    string description
  );
  event ProposalExecuted(uint256 proposalId);
  event ProposalQueued(uint256 proposalId, uint256 etaSeconds);
  event TimelockChange(address oldTimelock, address newTimelock);
  event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);
  event VoteCastWithParams(
    address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason, bytes params
  );

  receive() external payable;

  function BALLOT_TYPEHASH() external view returns (bytes32);
  function CLOCK_MODE() external view returns (string memory);
  function COUNTING_MODE() external pure returns (string memory);
  function EXTENDED_BALLOT_TYPEHASH() external view returns (bytes32);
  function cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
    external
    returns (uint256);
  function castVote(uint256 proposalId, uint8 support) external returns (uint256);
  function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes memory signature)
    external
    returns (uint256);
  function castVoteWithReason(uint256 proposalId, uint8 support, string memory reason) external returns (uint256);
  function castVoteWithReasonAndParams(uint256 proposalId, uint8 support, string memory reason, bytes memory params)
    external
    returns (uint256);
  function castVoteWithReasonAndParamsBySig(
    uint256 proposalId,
    uint8 support,
    address voter,
    string memory reason,
    bytes memory params,
    bytes memory signature
  ) external returns (uint256);
  function clock() external view returns (uint48);
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
  function execute(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
    external
    payable
    returns (uint256);
  function getVotes(address account, uint256 timepoint) external view returns (uint256);
  function getVotesWithParams(address account, uint256 timepoint, bytes memory params) external view returns (uint256);
  function hasVoted(uint256 proposalId, address account) external view returns (bool);
  function hashProposal(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
  ) external pure returns (uint256);
  function name() external view returns (string memory);
  function nonces(address owner) external view returns (uint256);
  function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
    external
    returns (bytes4);
  function onERC1155Received(address, address, uint256, uint256, bytes memory) external returns (bytes4);
  function onERC721Received(address, address, uint256, bytes memory) external returns (bytes4);
  function proposalDeadline(uint256 proposalId) external view returns (uint256);
  function proposalEta(uint256 proposalId) external view returns (uint256);
  function proposalNeedsQueuing(uint256 proposalId) external view returns (bool);
  function proposalProposer(uint256 proposalId) external view returns (address);
  function proposalSnapshot(uint256 proposalId) external view returns (uint256);
  function proposalThreshold() external view returns (uint256);
  function proposalVotes(uint256 proposalId)
    external
    view
    returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes);
  function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
  ) external returns (uint256);
  function queue(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
    external
    returns (uint256);
  function quorum(uint256) external pure returns (uint256);
  function relay(address target, uint256 value, bytes memory data) external payable;
  function state(uint256 proposalId) external view returns (ProposalState);
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
  function timelock() external view returns (address);
  function token() external view returns (address);
  function updateTimelock(address newTimelock) external;
  function version() external view returns (string memory);
  function votingDelay() external pure returns (uint256);
  function votingPeriod() external pure returns (uint256);
}
