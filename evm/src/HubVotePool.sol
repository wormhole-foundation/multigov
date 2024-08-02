// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {QueryResponse, ParsedQueryResponse, EthCallQueryResponse} from "wormhole/query/QueryResponse.sol";

import {ICrossChainVoteDecoder} from "src/interfaces/ICrossChainVoteDecoder.sol";

/// @title HubVotePool
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the `SpokeVoteAggregator`.
contract HubVotePool is QueryResponse, Ownable {
  using ERC165Checker for address;

  /// @notice The governor where cross chain votes are submitted.
  IGovernor public hubGovernor;

  /// @notice A necessary param which is ignored when submitting a vote.
  uint8 constant UNUSED_SUPPORT_PARAM = 1;

  /// @notice Thrown when the submitted spoke aggregator vote has a vote that is inconsistent with the previously
  /// submitted vote.
  error InvalidProposalVote();

  /// @notice Thrown if a query vote implementation is set to an address that does not support the
  /// `ICrossChainVoteDecoder` interface.
  error InvalidQueryVoteImpl();

  /// @notice Thrown if a vote query is submitted with an unsupported query type.
  error UnsupportedQueryType();

  /// @notice Emitted when a new query type is registered.
  event QueryTypeRegistered(uint16 indexed targetChain, address oldQueryTypeImpl, address newQueryTypeImpl);

  /// @notice Emitted when a vote is recorded from a registered spoke vote aggregator.
  event SpokeVoteCast(
    uint16 indexed emitterChainId, uint256 proposalId, uint256 voteAgainst, uint256 voteFor, uint256 voteAbstain
  );

  /// @notice Emitted whtn a new spoke vote address is registered.
  event SpokeRegistered(uint16 indexed targetChain, bytes32 oldSpokeVoteAddress, bytes32 newSpokeVoteAddress);

  /// @dev Contains the distribution of a proposal vote.
  struct ProposalVote {
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  /// @dev Contains the information to register a spoke.
  struct SpokeVoteAggregator {
    uint16 wormholeChainId;
    address addr;
  }

  /// @notice A mapping of a chain and emitter address that determines valid spokes and addresses for receiving votes.
  mapping(uint16 emitterChain => bytes32 emitterAddress) public spokeRegistry;

  mapping(bytes32 spokeProposalId => ProposalVote proposalVotes) public spokeProposalVotes;

  mapping(uint8 queryType => ICrossChainVoteDecoder voteImpl) public voteTypeDecoder;

  constructor(address _core, address _hubGovernor, SpokeVoteAggregator[] memory _initialSpokeRegistry)
    QueryResponse(_core)
    Ownable(_hubGovernor)
  {
    hubGovernor = IGovernor(_hubGovernor);
    for (uint256 i = 0; i < _initialSpokeRegistry.length; i++) {
      SpokeVoteAggregator memory aggregator = _initialSpokeRegistry[i];
      spokeRegistry[aggregator.wormholeChainId] = bytes32(uint256(uint160(aggregator.addr)));
      emit SpokeRegistered(
        aggregator.wormholeChainId, bytes32(uint256(uint160(address(0)))), bytes32(uint256(uint160(aggregator.addr)))
      );
    }
  }

  function registerQueryType(uint8 _queryType, address _implementation) external {
    _checkOwner();
    if (_implementation == address(0)) {
      delete voteTypeDecoder[_queryType];
      return;
    }
    bool isValid = _implementation.supportsInterface(type(ICrossChainVoteDecoder).interfaceId);
    if (!isValid) revert InvalidQueryVoteImpl();
    emit QueryTypeRegistered(_queryType, address(voteTypeDecoder[_queryType]), _implementation);
    voteTypeDecoder[_queryType] = ICrossChainVoteDecoder(_implementation);
  }

  function registerSpoke(uint16 _targetChain, bytes32 _spokeVoteAddress) external {
    _checkOwner();
    emit SpokeRegistered(_targetChain, spokeRegistry[_targetChain], _spokeVoteAddress);
    spokeRegistry[_targetChain] = _spokeVoteAddress;
  }

  function setGovernor(address _newGovernor) external {
    _checkOwner();
    hubGovernor = IGovernor(_newGovernor);
  }

  function crossChainVote(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) external {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ICrossChainVoteDecoder voteQueryImpl = voteTypeDecoder[_queryResponse.responses[i].queryType];
      if (address(voteQueryImpl) == address(0)) revert UnsupportedQueryType();

      ICrossChainVoteDecoder.QueryVote memory voteQuery = voteQueryImpl.decode(_queryResponse.responses[i]);
      ICrossChainVoteDecoder.ProposalVote memory proposalVote = voteQuery.proposalVote;
      ProposalVote memory existingSpokeVote = spokeProposalVotes[voteQuery.spokeProposalId];

      if (
        existingSpokeVote.againstVotes > proposalVote.againstVotes || existingSpokeVote.forVotes > proposalVote.forVotes
          || existingSpokeVote.abstainVotes > proposalVote.abstainVotes
      ) revert InvalidProposalVote();

      spokeProposalVotes[voteQuery.spokeProposalId] =
        ProposalVote(proposalVote.againstVotes, proposalVote.forVotes, proposalVote.abstainVotes);
      _castVote(
        voteQuery.proposalId,
        ProposalVote(
          proposalVote.againstVotes - existingSpokeVote.againstVotes,
          proposalVote.forVotes - existingSpokeVote.forVotes,
          proposalVote.abstainVotes - existingSpokeVote.abstainVotes
        ),
        voteQuery.chainId
      );
    }
  }

  function _castVote(uint256 proposalId, ProposalVote memory vote, uint16 emitterChainId) internal {
    bytes memory votes = abi.encodePacked(vote.againstVotes, vote.forVotes, vote.abstainVotes);

    hubGovernor.castVoteWithReasonAndParams(
      proposalId, UNUSED_SUPPORT_PARAM, "rolled-up vote from governance spoke token holders", votes
    );

    emit SpokeVoteCast(emitterChainId, proposalId, vote.againstVotes, vote.forVotes, vote.abstainVotes);
  }
}
