// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {
  QueryResponse,
  ParsedQueryResponse,
  ParsedPerChainQueryResponse,
  EthCallData,
  EthCallWithFinalityQueryResponse,
  InvalidContractAddress,
  InvalidFunctionSignature,
  InvalidChainId
} from "wormhole-sdk/QueryResponse.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";

/// @title SpokeMetadataCollector
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that receives proposal metadata from the hub governor.
contract SpokeMetadataCollector is QueryResponse {
  using BytesParsing for bytes;

  /// @notice The wormhole chain id of the hub.
  uint16 public immutable HUB_CHAIN_ID;
  /// @notice The address of the metadata contract to be read on the hub.
  address public immutable HUB_PROPOSAL_METADATA;

  /// @notice A struct that contains the proposal metadata
  struct Proposal {
    uint256 voteStart;
  }

  /// @notice A mapping of proposal id to a proposal on the spoke.
  mapping(uint256 proposalId => Proposal) internal proposals;

  /// @notice Thrown if the query is from a non-finalized block.
  error InvalidQueryBlock(bytes blockId);
  /// @notice Thrown if the proposal already exists on the spoke.
  error ProposalAlreadyExists(uint256 proposalId);
  /// @notice Thrown if there is more than a single parsed query response.
  error TooManyParsedQueryResponses(uint256 numResults);

  /// @notice Emitted when a new proposal is created on the spoke.
  event ProposalCreated(uint256 proposalId, uint256 start);

  /// @param _core The wormhole core contract that handles parsing and verifying incoming wormhole queries.
  /// @param _hubChainId The wormhole chain id of the hub.
  /// @param _hubProposalMetadata The proposal metadata contract address on the hub.
  constructor(address _core, uint16 _hubChainId, address _hubProposalMetadata) QueryResponse(_core) {
    HUB_CHAIN_ID = _hubChainId;
    HUB_PROPOSAL_METADATA = _hubProposalMetadata;
  }

  /// @notice A function that takes in a wormhole query, verifies, validates it and then creates a proposal on the
  /// spoke that can be used for voting.
  /// @param _queryResponseRaw A encoded wormhole query with an id and vote start of one or multiple hub proposals.
  /// @param _signatures An array of signatures of the hash of the query response.
  function addProposal(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) public {
    // Validate the query response signatures
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);

    if (_queryResponse.responses.length != 1) revert TooManyParsedQueryResponses(_queryResponse.responses.length);
    // Validate that the query response is from hub
    ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[0];
    _validateChainId(perChainResp.chainId);

    EthCallWithFinalityQueryResponse memory _ethCall =
      parseEthCallWithFinalityQueryResponse(_queryResponse.responses[0]);
    if (keccak256(_ethCall.requestFinality) != keccak256(bytes("finalized"))) {
      revert InvalidQueryBlock(_ethCall.requestBlockId);
    }

    for (uint256 i = 0; i < _ethCall.result.length; i++) {
      _validateEthCallData(_ethCall.result[i]);
      _ethCall.result[i].result.checkLength(64);
      (uint256 proposalId, uint256 voteStart) = abi.decode(_ethCall.result[i].result, (uint256, uint256));

      // If the proposal exists we can revert (prevent overwriting existing proposals with old zeroes)
      if (proposals[proposalId].voteStart != 0) revert ProposalAlreadyExists(proposalId);
      _addProposal(proposalId, voteStart);
    }
  }

  /// @notice A function to read the proposal metadata for a given proposal id.
  /// @param _proposalId The proposal id of the metadata to return.
  /// @return The proposal metadata for a given id.
  function getProposal(uint256 _proposalId) public view returns (Proposal memory) {
    return proposals[_proposalId];
  }

  /// @notice A function that stores a spoke proposal.
  /// @param _proposalId The proposal id of the proposal to create on the spoke.
  /// @param _voteStart The start of the voting period for the proposal.
  function _addProposal(uint256 _proposalId, uint256 _voteStart) internal {
    proposals[_proposalId] = Proposal(_voteStart);
    emit ProposalCreated(_proposalId, _voteStart);
  }

  /// @notice Validates the query response chain id is the hubs chain id.
  /// @param _responseChainId The chain id from the query response.
  function _validateChainId(uint16 _responseChainId) internal view {
    if (_responseChainId != HUB_CHAIN_ID) revert InvalidChainId();
  }

  /// @notice Validates the function signature in the query response calldata matches the expected function signature.
  /// @param _r The eth calldata from the query response.
  function _validateEthCallData(EthCallData memory _r) internal view {
    if (_r.contractAddress != HUB_PROPOSAL_METADATA) revert InvalidContractAddress();
    (bytes4 funcSig,) = _r.callData.asBytes4Unchecked(0);
    // The function signature should be bytes4(keccak256(bytes("getProposalMetadata(uint256)")))
    if (funcSig != bytes4(hex"eb9b9838")) revert InvalidFunctionSignature();
  }
}
