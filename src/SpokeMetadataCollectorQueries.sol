// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryResponse, ParsedQueryResponse, EthCallQueryResponse} from "wormhole/query/QueryResponse.sol";

contract SpokeMetadataCollector is QueryResponse {
  IWormhole public immutable WORMHOLE_CORE;
  uint16 public immutable HUB_CHAIN_ID;
  address public immutable HUB_GOVERNOR;

  struct Proposal {
    uint256 voteStart;
    uint256 voteEnd;
  }

  mapping(uint256 proposalId => Proposal) internal proposals;

  error ProposalAlreadyExists();
  error InvalidWormholeMessage(string);
  error TooManyQueryResponses(uint256);
  error SenderChainMismatch();

  event ProposalCreated(uint256 proposalId, uint256 startBlock, uint256 endBlock);

  constructor(address _core, uint16 _hubChainId, address _hubGovernor) QueryResponse(_core) {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_CHAIN_ID = _hubChainId;
    HUB_GOVERNOR = _hubGovernor;
  }

  function getProposal(uint256 proposalId) public view returns (Proposal memory) {
    return proposals[proposalId];
  }

  function addProposal(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) public {
    // Validate the query response signatures
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    // Validate that the query response is from hub
    // if (_queryResponse.senderChainId != HUB_CHAIN_ID) revert SenderChainMismatch();

    // TODO: Are we only expecting one response here?
    uint256 numResponses = _queryResponse.responses.length;
    if (numResponses != 1) revert TooManyQueryResponses(numResponses);

    EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(_queryResponse.responses[0]);
    if (_ethCalls.result[0].contractAddress != HUB_GOVERNOR) revert InvalidWormholeMessage("Invalid contract address");
    (uint256 proposalId, uint256 voteStart, uint256 voteEnd) = abi.decode(_ethCalls.result[0].result, (uint256,uint256,uint256));
    // If the proposal exists we can revert (prevent overwriting existing proposals with old zeroes)
    if (proposals[proposalId].voteStart != 0) revert ProposalAlreadyExists();
    _addProposal(proposalId, voteStart, voteEnd);
  }

  function _addProposal(uint256 proposalId, uint256 voteStart, uint256 voteEnd) internal {
    proposals[proposalId] = Proposal(voteStart, voteEnd);
    emit ProposalCreated(proposalId, voteStart, voteEnd);
  }
}
