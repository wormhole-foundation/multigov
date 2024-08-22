// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {
  QueryResponse,
  ParsedQueryResponse,
  ParsedPerChainQueryResponse,
  EthCallByTimestampQueryResponse,
  EthCallData,
  InvalidContractAddress,
  InvalidChainId,
  InvalidFunctionSignature
} from "wormhole-sdk/QueryResponse.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";

/// @title HubEvmSpokeAggregateProposer
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that gives addresses with voting weight fractured across multiple chains the ability to aggregate
/// their voting weight and create a proposal on the `HubGovernor`.
/// @dev This contract is meant to only support queries from EVM compatible chains.
contract HubEvmSpokeAggregateProposer is QueryResponse, Ownable {
  using BytesParsing for bytes;

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

  /// @notice A mapping of proposal id to the address that created the proposal.
  mapping(uint256 proposalId => address creator) public proposalCreators;

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

  /// @notice A function for an aggregate proposer to cancel the proposal they have created.
  /// @param _targets A list of contracts to call when a proposal is executed.
  /// @param _values A list of values to send when calling each target.
  /// @param _calldatas A list of calldatas to use when calling the targets.
  /// @param _descriptionHash A hash of the proposal's description.
  function cancel(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    bytes32 _descriptionHash
  ) external {
    uint256 _proposalId = HUB_GOVERNOR.hashProposal(_targets, _values, _calldatas, _descriptionHash);
    address creator = proposalCreators[_proposalId];
    if (msg.sender != creator) revert InvalidCaller(msg.sender, creator);
    HUB_GOVERNOR.cancel(_targets, _values, _calldatas, _descriptionHash);
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
  /// @return The id of the proposal created.
  function checkAndProposeIfEligible(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description,
    bytes memory _queryResponseRaw,
    IWormhole.Signature[] memory _signatures
  ) external returns (uint256) {
    bool _isEligible = _checkProposalEligibility(_queryResponseRaw, _signatures);
    if (!_isEligible) revert InsufficientVoteWeight();

    uint256 _proposalId = HUB_GOVERNOR.propose(_targets, _values, _calldatas, _description);
    proposalCreators[_proposalId] = msg.sender;

    return _proposalId;
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
  /// equal to the current timestamp, and use the callers address to get the weight.
  /// @param _queryResponseRaw The raw bytes of the query requests and response.
  /// @param _signatures Signatures validating that the queries are correct from the guardians.
  /// @return A boolean indicating whether the caller is eligible to create a proposal.
  function _checkProposalEligibility(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures)
    internal
    view
    returns (bool)
  {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    uint256 _totalVoteWeight = 0;
    uint256 _currentTimestamp = block.timestamp * 1_000_000;
    uint256 _oldestAllowedTimestamp = (_currentTimestamp - maxQueryTimestampOffset * 1_000_000);
    uint256 _sharedQueryBlockTime = 0;
    uint16[] memory seenValues = new uint16[](_queryResponse.responses.length);

    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ParsedPerChainQueryResponse memory _perChainResp = _queryResponse.responses[i];
      EthCallByTimestampQueryResponse memory _ethCalls = parseEthCallByTimestampQueryResponse(_perChainResp);
      _containsExistingChainId(seenValues, _perChainResp.chainId, i);

      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);
      _validateEthCallData(_perChainResp.chainId, _ethCalls.result[0]);

      uint64 _requestTargetTimestamp = _ethCalls.requestTargetTimestamp;

      if (_requestTargetTimestamp < _oldestAllowedTimestamp || _requestTargetTimestamp > _currentTimestamp) {
        revert InvalidTimestamp(_requestTargetTimestamp);
      }

      if (_sharedQueryBlockTime == 0) _sharedQueryBlockTime = _requestTargetTimestamp;
      if (_sharedQueryBlockTime != _requestTargetTimestamp) revert InvalidTimestamp(_requestTargetTimestamp);

      bytes memory _callData = _ethCalls.result[0].callData;

      // Extract the address from callData (skip first 4 bytes of function selector)
      (address _queriedAccount, uint256 _queriedTimepoint) = _extractAccountFromCalldata(_callData);

      // Check that the address being queried is the caller
      if (_queriedAccount != msg.sender) revert InvalidCaller(msg.sender, _queriedAccount);

      if (_queriedTimepoint * 1_000_000 != _requestTargetTimestamp) revert InvalidTimestamp(_requestTargetTimestamp);

      uint256 _voteWeight = abi.decode(_ethCalls.result[0].result, (uint256));
      _totalVoteWeight += _voteWeight;
    }

    // Use current timestamp (what all of the spoke query responses are checked against) to get the hub vote weight
    uint256 _hubVoteWeight = HUB_GOVERNOR.getVotes(msg.sender, _sharedQueryBlockTime);
    _totalVoteWeight += _hubVoteWeight;

    return _totalVoteWeight >= HUB_GOVERNOR.proposalThreshold();
  }

  /// @notice Extracts the address used to get the voting weight from the query.
  /// @param _calldata The calldata from which to extract the address.
  /// @return Address and timepoint in the calldata that was used to get votes.
  function _extractAccountFromCalldata(bytes memory _calldata) internal pure returns (address, uint256) {
    (uint256 _extractedAccount, uint256 _nextOffset) = _calldata.asUint256Unchecked(4);
    (uint256 _extractedTimepoint,) = _calldata.asUint256Unchecked(_nextOffset);

    // Ensure calldata is long enough to contain function selector (4 bytes), a padded address (32 bytes) and uint256
    // (32 bytes)
    _calldata.checkLength(68);

    return (address(uint160(_extractedAccount)), _extractedTimepoint);
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

  /// @notice Validates the query eth calldata was from the expected spoke contract and contains the expected function
  /// signature.
  /// @param _chainId The wormhole chain id of the query.
  /// @param _r The Eth calldata of the query.
  function _validateEthCallData(uint16 _chainId, EthCallData memory _r) internal view {
    address _registeredSpokeAddress = registeredSpokes[_chainId];
    if (_registeredSpokeAddress == address(0) || _r.contractAddress != _registeredSpokeAddress) {
      revert InvalidContractAddress();
    }
    (bytes4 funcSig,) = _r.callData.asBytes4Unchecked(0);
    // Expected function hash is bytes4(keccak256("getVotes(address,uint256)"))
    if (funcSig != bytes4(hex"eb9019d4")) revert InvalidFunctionSignature();
  }

  /// @notice Verifies that the same chain id has not been seen already.
  /// @param _seenChainIds An array of chain ids that have already been seen.
  /// @param _newChainId The chain id that is checked against the seen ids.
  /// @param _endIdx The per chain query response index.
  function _containsExistingChainId(uint16[] memory _seenChainIds, uint16 _newChainId, uint256 _endIdx) internal pure {
    for (uint256 i = 0; i < _endIdx; i++) {
      if (_seenChainIds[i] == _newChainId) revert InvalidChainId();
    }
    _seenChainIds[_endIdx] = _newChainId;
  }
}
