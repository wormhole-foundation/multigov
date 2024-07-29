// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {
  QueryResponse,
  ParsedQueryResponse,
  ParsedPerChainQueryResponse,
  EthCallWithFinalityQueryResponse
} from "wormhole/query/QueryResponse.sol";

contract SpokeMetadataCollector is QueryResponse {
  IWormhole public immutable WORMHOLE_CORE;
  uint16 public immutable HUB_CHAIN_ID;
  address public immutable HUB_PROPOSAL_METADATA;

  struct Proposal {
    uint256 voteStart;
  }

  // TODO: Add underscore here
  mapping(uint256 proposalId => Proposal) internal proposals;

  error ProposalAlreadyExists();
  error InvalidWormholeMessage(string);
  error TooManyQueryResponses(uint256);
  error SenderChainMismatch();
  error TooManyEthCallResults(uint256, uint256);
  error InvalidQueryBlock(bytes);

  event ProposalCreated(uint256 proposalId, uint256 start);

  constructor(address _core, uint16 _hubChainId, address _hubProposalMetadata) QueryResponse(_core) {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_CHAIN_ID = _hubChainId;
    HUB_PROPOSAL_METADATA = _hubProposalMetadata;
  }

  function getProposal(uint256 proposalId) public view returns (Proposal memory) {
    return proposals[proposalId];
  }

  function addProposal(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) public {
    // Validate the query response signatures
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);

    // Validate that the query response is from hub
    ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[0];
    if (perChainResp.chainId != HUB_CHAIN_ID) revert SenderChainMismatch();

    uint256 numResponses = _queryResponse.responses.length;

    for (uint256 i = 0; i < numResponses; i++) {
      EthCallWithFinalityQueryResponse memory _ethCalls =
        parseEthCallWithFinalityQueryResponse(_queryResponse.responses[i]);
      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(i, _ethCalls.result.length);
      if (_ethCalls.result[0].contractAddress != HUB_PROPOSAL_METADATA) {
        revert InvalidWormholeMessage("Query data must be from hub proposal metadata contract");
      }
      if (keccak256(_ethCalls.requestFinality) != keccak256(bytes("finalized"))) {
        revert InvalidQueryBlock(_ethCalls.requestBlockId);
      }
      (uint256 proposalId, uint256 voteStart) = abi.decode(_ethCalls.result[0].result, (uint256, uint256));

      // If the proposal exists we can revert (prevent overwriting existing proposals with old zeroes)
      if (proposals[proposalId].voteStart != 0) revert ProposalAlreadyExists();
      _addProposal(proposalId, voteStart);
    }
  }

  function _addProposal(uint256 proposalId, uint256 voteStart) internal {
    proposals[proposalId] = Proposal(voteStart);
    emit ProposalCreated(proposalId, voteStart);
  }
}
