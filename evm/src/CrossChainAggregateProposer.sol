// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {
  QueryResponse,
  ParsedQueryResponse,
  ParsedPerChainQueryResponse,
  EthCallByTimestampQueryResponse
} from "wormhole/query/QueryResponse.sol";

/// @title CrossChainAggregateProposer
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that gives addresses with voting weight fractured across multiple chains the ability to aggregate
/// their voting weight and create a proposal on the `HubGovernor`.
/// @dev This contract is meant to only support queries from EVM compatible chains.
contract CrossChainAggregateProposer is QueryResponse, Ownable {
  /// @notice The governor where new proposals will be created.
  IGovernor public immutable HUB_GOVERNOR;

  /// @notice The max timestamp difference between the requested target time in the query and the current block time on
  /// the hub.
  uint48 public maxQueryTimestampOffset;

  /// @notice Emitted when the max timestamp offset is updated.
  event MaxQueryTimestampOffsetUpdated(uint48 oldMaxQueryTimestampOffset, uint48 newMaxQueryTimestampOffset);

  /// @notice Emitted when a spoke is registered.
  event SpokeRegistered(uint16 indexed chainId, address oldSpokeAddress, address newSpokeAddress);

  /// @notice Thrown when the aggregation of voting weight is less than the proposal threshold on the `HUB_GOVERNOR`.
  error InsufficientVoteWeight();

  /// @notice Thrown when calldata in the query response is too short.
  error InvalidCallDataLength();

  /// @notice Thrown when the function caller is different from address used to get the vote weight in the query.
  error InvalidCaller(address expected, address actual);

  /// @notice Thrown when the offset is attempted to be set to 0.
  error InvalidOffset();

  /// @notice Thrown when the timestamp is not the same for all queries, the timestamp is below the offset or greater
  /// than the current timestamp.
  error InvalidTimestamp(uint64 invalidTimestamp);

  /// @notice Thrown when the number of calls in a query is greater than 1.
  error TooManyEthCallResults(uint256 numCalls);

  /// @notice Thrown when a spoke address is not registered for a given chain.
  error UnregisteredSpoke(uint16 chainId, address spokeAddress);

  /// @notice A mapping of registered spoke aggregators per chain. These chains and addresses determine the chains and
  /// addresses that can be queried in order to aggregate voting weight.
  mapping(uint16 wormholeChainId => address spokeVoteAggregator) public registeredSpokes;

  /// @param _core The Wormhole core contract for the hub chain.
  /// @param _hubGovernor The governor where proposals are created.
  /// @param _initialMaxQueryTimestampOffset The initial offset for queries.
  constructor(address _core, address _hubGovernor, uint48 _initialMaxQueryTimestampOffset)
    QueryResponse(_core)
    Ownable(_hubGovernor)
  {
    HUB_GOVERNOR = IGovernor(_hubGovernor);
    maxQueryTimestampOffset = _initialMaxQueryTimestampOffset;
  }

  /// @notice The function takes in wormhole queries and aggregates the voting weight across the spokes and hub for the
  /// caller. If the total voting weight is greater than the proposal threshold on the governor then the passed in
  /// proposal is created.
  /// @param _targets A list of contracts to call when a proposal is executed.
  /// @param _values A list of values to send when calling each target.
  /// @param _calldatas A list of calldatas to use when calling the targets.
  /// @param _description A description of the proposal.
  /// @param _queryResponseRaw The raw bytes of the query requests and response.
  /// @param _signatures Signatures from the guardians validating the queries are correct.
  function checkAndProposeIfEligible(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description,
    bytes memory _queryResponseRaw,
    IWormhole.Signature[] memory _signatures
  ) external returns (uint256) {
    bool isEligible = _checkProposalEligibility(_queryResponseRaw, _signatures);
    if (!isEligible) revert InsufficientVoteWeight();

    uint256 proposalId = HUB_GOVERNOR.propose(_targets, _values, _calldatas, _description);

    return proposalId;
  }

  /// @notice The owner registers a new chain and spoke vote aggregator address.
  /// @param _chainId The chain id to register.
  /// @param _spokeVoteAggregator The spoke vote aggregator to register.
  function registerSpoke(uint16 _chainId, address _spokeVoteAggregator) external {
    _checkOwner();
    _registerSpoke(_chainId, _spokeVoteAggregator);
  }

  /// @notice The owner sets a new max offset time for incoming queries.
  /// @param _newMaxQueryTimestampOffset The new max query time offset.
  function setMaxQueryTimestampOffset(uint48 _newMaxQueryTimestampOffset) external {
    _checkOwner();
    _setMaxQueryTimestampOffset(_newMaxQueryTimestampOffset);
  }

  /// @notice Verifies that a caller has the appropriate voting weight and has submitted valid queries. A valid query
  /// will share the same timestamp with all of the other queries, be greater than the offset timestamp, less than or
  /// equal to the current timestamp and use the callers address to get the weight.
  /// @param _queryResponseRaw The raw bytes of the query requests and response.
  /// @param _signatures Signatures from the guardians validating the queries are correct.
  function _checkProposalEligibility(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures)
    internal
    view
    returns (bool)
  {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    uint256 totalVoteWeight = 0;
    uint256 currentTimestamp = block.timestamp;
    uint256 oldestAllowedTimestamp = currentTimestamp - maxQueryTimestampOffset;
    uint256 sharedQueryBlockTime = 0;

    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[i];
      EthCallByTimestampQueryResponse memory _ethCalls = parseEthCallByTimestampQueryResponse(perChainResp);

      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

      uint64 requestTargetTimestamp = _ethCalls.requestTargetTimestamp;

      if (requestTargetTimestamp < oldestAllowedTimestamp || requestTargetTimestamp > currentTimestamp) {
        revert InvalidTimestamp(requestTargetTimestamp);
      }

      if (sharedQueryBlockTime == 0) sharedQueryBlockTime = requestTargetTimestamp;
      if (sharedQueryBlockTime != requestTargetTimestamp) revert InvalidTimestamp(requestTargetTimestamp);

      address registeredSpokeAddress = registeredSpokes[perChainResp.chainId];
      address queriedAddress = _ethCalls.result[0].contractAddress;

      if (registeredSpokeAddress == address(0) || queriedAddress != registeredSpokeAddress) {
        revert UnregisteredSpoke(perChainResp.chainId, queriedAddress);
      }

      bytes memory callData = _ethCalls.result[0].callData;

      // Extract the address from callData (skip first 4 bytes of function selector)
      address queriedAccount = _extractAccountFromCalldata(callData);

      // Check that the address being queried is the caller
      if (queriedAccount != msg.sender) revert InvalidCaller(msg.sender, queriedAccount);

      uint256 voteWeight = abi.decode(_ethCalls.result[0].result, (uint256));
      totalVoteWeight += voteWeight;
    }

    // Use current timestamp (what all of the spoke query responses are checked against) to get the hub vote weight
    uint256 hubVoteWeight = HUB_GOVERNOR.getVotes(msg.sender, sharedQueryBlockTime);
    totalVoteWeight += hubVoteWeight;

    return totalVoteWeight >= HUB_GOVERNOR.proposalThreshold();
  }

  /// @notice Extracts the address used to get the voting weight from the query.
  /// @param _callData The calldata from which to extract the address.
  function _extractAccountFromCalldata(bytes memory _callData) internal pure returns (address) {
    // Ensure callData is long enough to contain function selector (4 bytes) and an address (20 bytes)
    if (_callData.length < 24) revert InvalidCallDataLength();

    address extractedAccount;
    assembly {
      extractedAccount := mload(add(add(_callData, 0x20), 4))
    }

    return extractedAccount;
  }

  /// @notice Registers a new chain and address from where to receive queries.
  /// @param _chainId The chain id to register.
  /// @param _spokeAddress The spoke address to register.
  function _registerSpoke(uint16 _chainId, address _spokeAddress) internal {
    emit SpokeRegistered(_chainId, registeredSpokes[_chainId], _spokeAddress);
    registeredSpokes[_chainId] = _spokeAddress;
  }

  /// @notice Sets a new max offset time for incoming queries.
  /// @param _newMaxQueryTimestampOffset The new max query time offset.
  function _setMaxQueryTimestampOffset(uint48 _newMaxQueryTimestampOffset) internal {
    if (_newMaxQueryTimestampOffset == 0) revert InvalidOffset();
    emit MaxQueryTimestampOffsetUpdated(maxQueryTimestampOffset, _newMaxQueryTimestampOffset);
    maxQueryTimestampOffset = _newMaxQueryTimestampOffset;
  }
}
