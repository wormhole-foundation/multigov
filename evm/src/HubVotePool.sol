// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubEvmSpokeVoteDecoder} from "src/HubEvmSpokeVoteDecoder.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryResponse, ParsedQueryResponse} from "wormhole-sdk/QueryResponse.sol";
import {Checkpoints} from "src/lib/Checkpoints.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title HubVotePool
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the `SpokeVoteAggregator`.
contract HubVotePool is QueryResponse, Ownable {
  using Checkpoints for Checkpoints.Trace256;
  using ERC165Checker for address;

  /// @notice The governor where cross chain votes are submitted.
  IGovernor public hubGovernor;

  /// @notice A necessary param which is ignored when submitting a vote.
  uint8 private constant UNUSED_SUPPORT_PARAM = 1;

  /// @notice Thrown when the submitted spoke aggregator vote has a vote that is inconsistent with the previously
  /// submitted vote.
  error InvalidProposalVote();

  /// @notice Thrown if a query vote implementation is set to an address that does not support the
  /// `ISpokeVoteDecoder` interface.
  error InvalidQueryVoteImpl();

  /// @notice Thrown if a vote query is submitted with an unsupported query type.
  error UnsupportedQueryType();

  /// @notice Emitted when the Governor is updated.
  event HubGovernorUpdated(address oldGovernor, address newGovernor);

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
    uint256 againstVotes;
    uint256 forVotes;
    uint256 abstainVotes;
  }

  /// @dev Contains the information to register a spoke.
  struct SpokeVoteAggregator {
    uint16 wormholeChainId;
    bytes32 wormholeAddress;
  }

  /// @notice A mapping of a chain and emitter address that determines valid spokes and addresses for receiving votes.
  // Add 256 checkpoints for registry
  mapping(uint16 emitterChain => Checkpoints.Trace256 emitterAddress) internal emitterRegistry;

  mapping(bytes32 spokeProposalId => ProposalVote proposalVotes) public spokeProposalVotes;

  mapping(uint8 queryType => ISpokeVoteDecoder voteImpl) public voteTypeDecoder;

  constructor(address _core, address _hubGovernor, address _owner) QueryResponse(_core) Ownable(_owner) {
    HubEvmSpokeVoteDecoder evmDecoder = new HubEvmSpokeVoteDecoder(_core, address(this));
    _registerQueryType(address(evmDecoder), QueryResponse.QT_ETH_CALL_WITH_FINALITY);
    _setGovernor(_hubGovernor);
  }

  function getSpoke(uint16 _emitterChainId, uint256 _timepoint) external view returns (bytes32) {
    return bytes32(emitterRegistry[_emitterChainId].upperLookup(_timepoint));
  }

  /// @notice Registers or unregisters a query type implementation.
  /// @dev Can only be called by the contract owner. Unregisters if the implementation address is zero.
  /// @param _queryType The type of query to register.
  /// @param _implementation The address of the implementation contract for the query type.
  function registerQueryType(uint8 _queryType, address _implementation) external {
    _checkOwner();
    _registerQueryType(_implementation, _queryType);
  }

  /// @notice Registers a new spoke chain and its vote aggregator address.
  /// @dev Can only be called by the contract owner.
  /// @param _targetChain The Wormhole chain ID of the spoke chain.
  /// @param _spokeVoteAddress The address of the vote aggregator on the spoke chain.
  function registerSpoke(uint16 _targetChain, bytes32 _spokeVoteAddress) external {
    _checkOwner();
    _registerSpoke(_targetChain, _spokeVoteAddress);
  }

  /// @notice Registers multiple spoke chains with their corresponding vote aggregator in a single call.
  /// @param _spokes An an array of spoke vote aggregators to be registered.
  function registerSpokes(SpokeVoteAggregator[] memory _spokes) external {
    _checkOwner();
    for (uint256 i = 0; i < _spokes.length; i++) {
      SpokeVoteAggregator memory _aggregator = _spokes[i];
      _registerSpoke(_aggregator.wormholeChainId, _aggregator.wormholeAddress);
    }
  }

  /// @notice Updates the address of the hub governor.
  /// @dev Can only be called by the contract owner.
  /// @param _newGovernor The address of the new hub governor.
  function setGovernor(address _newGovernor) external {
    _checkOwner();
    _setGovernor(_newGovernor);
  }

  /// @notice Processes cross chain votes from the spokes. Parses and verifies the Wormhole query response, then casts
  /// votes on the hub governor.
  /// @param _queryResponseRaw The raw bytes of the query response from Wormhole.
  /// @param _signatures The signatures verifying the Wormhole message.
  function crossChainVote(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) external {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ISpokeVoteDecoder _voteQueryImpl = voteTypeDecoder[_queryResponse.responses[i].queryType];
      if (address(_voteQueryImpl) == address(0)) revert UnsupportedQueryType();

      ISpokeVoteDecoder.QueryVote memory _voteQuery = _voteQueryImpl.decode(_queryResponse.responses[i], hubGovernor);
      ISpokeVoteDecoder.ProposalVote memory _proposalVote = _voteQuery.proposalVote;
      ProposalVote memory _existingSpokeVote = spokeProposalVotes[_voteQuery.spokeProposalId];

      if (
        _existingSpokeVote.againstVotes > _proposalVote.againstVotes
          || _existingSpokeVote.forVotes > _proposalVote.forVotes
          || _existingSpokeVote.abstainVotes > _proposalVote.abstainVotes
      ) revert InvalidProposalVote();

      spokeProposalVotes[_voteQuery.spokeProposalId] =
        ProposalVote(_proposalVote.againstVotes, _proposalVote.forVotes, _proposalVote.abstainVotes);
      _castVote(
        _voteQuery.proposalId,
        ProposalVote(
          _proposalVote.againstVotes - _existingSpokeVote.againstVotes,
          _proposalVote.forVotes - _existingSpokeVote.forVotes,
          _proposalVote.abstainVotes - _existingSpokeVote.abstainVotes
        ),
        _voteQuery.chainId
      );
    }
  }

  function _castVote(uint256 _proposalId, ProposalVote memory _vote, uint16 _emitterChainId) internal {
    bytes memory _votes = abi.encodePacked(
      SafeCast.toUint128(_vote.againstVotes), SafeCast.toUint128(_vote.forVotes), SafeCast.toUint128(_vote.abstainVotes)
    );

    hubGovernor.castVoteWithReasonAndParams(
      _proposalId, UNUSED_SUPPORT_PARAM, "rolled-up vote from governance spoke token holders", _votes
    );

    emit SpokeVoteCast(_emitterChainId, _proposalId, _vote.againstVotes, _vote.forVotes, _vote.abstainVotes);
  }

  function _registerSpoke(uint16 _targetChain, bytes32 _spokeVoteAddress) internal {
    Checkpoints.Trace256 storage registeredAddressCheckpoint = emitterRegistry[_targetChain];
    emit SpokeRegistered(
      _targetChain, bytes32(registeredAddressCheckpoint.upperLookup(block.timestamp)), _spokeVoteAddress
    );
    registeredAddressCheckpoint.push(block.timestamp, uint256(_spokeVoteAddress));
  }

  function _registerQueryType(address _implementation, uint8 _queryType) internal {
    if (_implementation == address(0)) {
      delete voteTypeDecoder[_queryType];
      return;
    }
    bool _isValid = _implementation.supportsInterface(type(ISpokeVoteDecoder).interfaceId);
    if (!_isValid) revert InvalidQueryVoteImpl();
    emit QueryTypeRegistered(_queryType, address(voteTypeDecoder[_queryType]), _implementation);
    voteTypeDecoder[_queryType] = ISpokeVoteDecoder(_implementation);
  }

  function _setGovernor(address _newGovernor) internal {
    emit HubGovernorUpdated(address(hubGovernor), _newGovernor);
    hubGovernor = IGovernor(_newGovernor);
  }
}
