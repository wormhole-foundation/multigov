// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
  QueryResponse,
  ParsedQueryResponse,
  ParsedPerChainQueryResponse,
  EthCallQueryResponse
} from "wormhole/query/QueryResponse.sol";

contract HubVotePool is QueryResponse, Ownable {
  IWormhole public immutable WORMHOLE_CORE;
  IGovernor public hubGovernor;
  uint8 constant UNUSED_SUPPORT_PARAM = 1;
  uint16 public constant SOLANA_CHAIN_ID = 1;

  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();
  error InvalidProposalVote();
  error InvalidChainId();
  error TooManyEthCallResults(uint256);
  error TooManyQueryResponses(uint256);

  event SpokeVoteCast(
    uint16 indexed emitterChainId, uint256 proposalId, uint256 voteAgainst, uint256 voteFor, uint256 voteAbstain
  );

  event SpokeRegistered(uint16 indexed targetChain, bytes32 oldSpokeVoteAddress, bytes32 newSpokeVoteAddress);

  /// @dev Contains the distribution of a proposal vote.
  struct ProposalVote {
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  struct SpokeVoteAggregator {
    uint16 wormholeChainId;
    address addr;
  }

  mapping(uint16 emitterChain => bytes32 emitterAddress) public spokeRegistry;

  // Instead of nested mapping create encoding for the key
  mapping(bytes32 spokeProposalId => ProposalVote proposalVotes) public spokeProposalVotes;

  constructor(address _core, address _hubGovernor, SpokeVoteAggregator[] memory _initialSpokeRegistry)
    QueryResponse(_core)
    Ownable(_hubGovernor)
  {
    WORMHOLE_CORE = IWormhole(_core);
    hubGovernor = IGovernor(_hubGovernor);
    for (uint256 i = 0; i < _initialSpokeRegistry.length; i++) {
      SpokeVoteAggregator memory aggregator = _initialSpokeRegistry[i];
      spokeRegistry[aggregator.wormholeChainId] = bytes32(uint256(uint160(aggregator.addr)));
      emit SpokeRegistered(
        aggregator.wormholeChainId, bytes32(uint256(uint160(address(0)))), bytes32(uint256(uint160(aggregator.addr)))
      );
    }
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

  // get data offset
  // Data length I think is lenght of account fields, data offset is where the data beigns from. I don't know what it is for us to start
  // 
  //
  // function crossChainSolanaVote(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) external {
  //   	  ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
  //   	  if (r.responses.length != 1) {
  //   			  revert TooManyQueryResponses(r.responses.length);
  //   	  }
  //   	  ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[0];
  //   	  if (perChainResp.chainId != SOLANA_CHAIN_ID ) {
  //   			  revert InvalidChainId();
  //   	  }
  //   	  bytes32 addr = spokeRegistry[perChainResp.chainId];
  //   if (addr != bytes32(uint256(uint160(_ethCalls.result[0].contractAddress))) ) {
  //     revert UnknownMessageEmitter();
  //   }
  // }

  function crossChainEVMVote(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) external {
    // Validate the query response signatures
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);

    uint256 numResponses = _queryResponse.responses.length;
    if (numResponses != 1) revert TooManyQueryResponses(numResponses);

    // Validate that the query response is from hub
    ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[0];

    EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(perChainResp);

    // verify contract and chain is correct
    bytes32 addr = spokeRegistry[perChainResp.chainId];
    if (addr != bytes32(uint256(uint160(_ethCalls.result[0].contractAddress))) || addr == bytes32("")) {
      revert UnknownMessageEmitter();
    }

    if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

    (uint256 proposalId, uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
      abi.decode(_ethCalls.result[0].result, (uint256, uint128, uint128, uint128));

    // TODO: does encode vs encodePacked matter here
    bytes32 _spokeProposalId = keccak256(abi.encode(perChainResp.chainId, proposalId));
    ProposalVote memory existingSpokeVote = spokeProposalVotes[_spokeProposalId];
    if (
      existingSpokeVote.againstVotes > againstVotes || existingSpokeVote.forVotes > forVotes
        || existingSpokeVote.abstainVotes > abstainVotes
    ) revert InvalidProposalVote();

    spokeProposalVotes[_spokeProposalId] = ProposalVote(againstVotes, forVotes, abstainVotes);

    _castVote(
      proposalId,
      ProposalVote(
        againstVotes - existingSpokeVote.againstVotes,
        forVotes - existingSpokeVote.forVotes,
        abstainVotes - existingSpokeVote.abstainVotes
      ),
      perChainResp.chainId
    );
  }

  function _castVote(uint256 proposalId, ProposalVote memory vote, uint16 emitterChainId) internal {
    bytes memory votes = abi.encodePacked(vote.againstVotes, vote.forVotes, vote.abstainVotes);

    hubGovernor.castVoteWithReasonAndParams(
      proposalId, UNUSED_SUPPORT_PARAM, "rolled-up vote from governance spoke token holders", votes
    );

    emit SpokeVoteCast(emitterChainId, proposalId, vote.againstVotes, vote.forVotes, vote.abstainVotes);
  }
}
