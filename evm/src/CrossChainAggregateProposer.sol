// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryResponse, ParsedQueryResponse, ParsedPerChainQueryResponse} from "wormhole/query/QueryResponse.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ICrossChainVoteWeight} from "src/interfaces/ICrossChainVoteWeight.sol";

contract CrossChainAggregateProposer is QueryResponse, Ownable {
  IGovernor public immutable HUB_GOVERNOR;
  IWormhole public immutable WORMHOLE_CORE;
  uint48 public maxQueryTimestampOffset;

  mapping(uint8 queryType => ICrossChainVoteWeight voteWeightGetterImpl) public queryTypeVoteWeightGetter;
  mapping(uint16 => address) public registeredSpokes;

  error InsufficientVoteWeight();
  error InvalidImplementation(address implementation);
  error InvalidMaxQueryTimestampOffset(uint48 offset);
  error InvalidTimestamp(uint256 timestamp, uint256 minAllowed, uint256 maxAllowed);
  error UnregisteredSpoke(uint16 chainId, address spokeAddress);
  error UnsupportedQueryType(uint8 queryType);

  event SpokeRegistered(uint16 indexed chainId, address spokeAddress);
  event MaxQueryTimestampOffsetUpdated(uint48 oldMaxQueryTimestampOffset, uint48 newMaxQueryTimestampOffset);
  event QueryTypeVoteWeightGetterRegistered(uint8 indexed queryType, address oldGetter, address newGetter);

  constructor(address _core, address _hubGovernor, uint48 _initialMaxQueryTimestampOffset)
    QueryResponse(_core)
    Ownable(_hubGovernor)
  {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_GOVERNOR = IGovernor(_hubGovernor);
    maxQueryTimestampOffset = _initialMaxQueryTimestampOffset;
  }

  function checkAndProposeIfEligible(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description,
    bytes memory _queryResponseRaw,
    IWormhole.Signature[] memory _signatures
  ) external returns (uint256) {
    bool isEligible = _checkProposalEligibility(_queryResponseRaw, _signatures);
    if (!isEligible) revert InsufficientVoteWeight();

    uint256 proposalId = HUB_GOVERNOR.propose(targets, values, calldatas, description);

    return proposalId;
  }

  function registerSpoke(uint16 chainId, address spokeAddress) external {
    _checkOwner();
    _registerSpoke(chainId, spokeAddress);
  }

  function setMaxQueryTimestampOffset(uint48 _newMaxQueryTimestampOffset) external {
    _checkOwner();
    _setMaxQueryTimestampOffset(_newMaxQueryTimestampOffset);
  }

  function registerQueryTypeVoteWeightGetter(uint8 _queryType, address _implementation) external {
    _checkOwner();
    _registerQueryTypeVoteWeightGetter(_queryType, _implementation);
  }

  function _checkProposalEligibility(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures)
    internal
    view
    returns (bool)
  {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    uint256 totalVoteWeight = 0;
    uint256 currentTimestamp = block.timestamp;
    uint256 oldestAllowedTimestamp = currentTimestamp - maxQueryTimestampOffset;

    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[i];

      address registeredSpokeAddress = registeredSpokes[perChainResp.chainId];
      if (registeredSpokeAddress == address(0)) revert UnregisteredSpoke(perChainResp.chainId, address(0));

      ICrossChainVoteWeight voteWeightGetter = queryTypeVoteWeightGetter[perChainResp.queryType];
      if (address(voteWeightGetter) == address(0)) revert UnsupportedQueryType(perChainResp.queryType);

      ICrossChainVoteWeight.CrossChainVoteWeightResult memory voteWeightResult =
        voteWeightGetter.getVoteWeight(perChainResp);

      if (voteWeightResult.blockTime < oldestAllowedTimestamp || voteWeightResult.blockTime > currentTimestamp) {
        revert InvalidTimestamp(voteWeightResult.blockTime, oldestAllowedTimestamp, currentTimestamp);
      }
      totalVoteWeight += voteWeightResult.voteWeight;
    }

    totalVoteWeight += HUB_GOVERNOR.getVotes(msg.sender, currentTimestamp);

    return totalVoteWeight >= HUB_GOVERNOR.proposalThreshold();
  }

  function _setMaxQueryTimestampOffset(uint48 _newMaxQueryTimestampOffset) internal {
    if (_newMaxQueryTimestampOffset == 0) revert InvalidMaxQueryTimestampOffset(_newMaxQueryTimestampOffset);
    emit MaxQueryTimestampOffsetUpdated(maxQueryTimestampOffset, _newMaxQueryTimestampOffset);
    maxQueryTimestampOffset = _newMaxQueryTimestampOffset;
  }

  function _registerQueryTypeVoteWeightGetter(uint8 _queryType, address _implementation) internal {
    if (_implementation == address(0)) {
      queryTypeVoteWeightGetter[_queryType] = ICrossChainVoteWeight(_implementation);
      return;
    }

    bool isValid = IERC165(_implementation).supportsInterface(type(ICrossChainVoteWeight).interfaceId);
    if (!isValid) revert InvalidImplementation(_implementation);

    emit QueryTypeVoteWeightGetterRegistered(
      _queryType, address(queryTypeVoteWeightGetter[_queryType]), _implementation
    );
    queryTypeVoteWeightGetter[_queryType] = ICrossChainVoteWeight(_implementation);
  }

  function _registerSpoke(uint16 chainId, address spokeAddress) internal {
    registeredSpokes[chainId] = spokeAddress;
    emit SpokeRegistered(chainId, spokeAddress);
  }
}
