// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {console} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {
  QueryResponse,
  ParsedQueryResponse,
  ParsedPerChainQueryResponse,
  EthCallQueryResponse
} from "wormhole/query/QueryResponse.sol";

contract CrosschainAggregateProposer is QueryResponse, Ownable {
  IGovernor public immutable HUB_GOVERNOR;
  IWormhole public immutable WORMHOLE_CORE;
  uint48 public minAllowedTimeDelta;

  mapping(uint16 => address) public registeredSpokes;

  error InsufficientVoteWeight();
  error InvalidCallDataLength();
  error InvalidCaller(address expected, address actual);
  error InvalidTimeDelta();
  error InvalidTimestamp();
  error TooManyEthCallResults(uint256);
  error UnregisteredSpoke(uint16 chainId, address tokenAddress);
  error ZeroTokenAddress();

  event SpokeRegistered(uint16 chainId, address spokeAddress);
  event MinAllowedTimeDeltaUpdated(uint256 oldMinAllowedTimeDelta, uint256 newMinAllowedTimeDelta);

  constructor(address _core, address _hubGovernor, uint48 _initialMinAllowedTimeDelta)
    QueryResponse(_core)
    Ownable(_hubGovernor)
  {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_GOVERNOR = IGovernor(_hubGovernor);
    minAllowedTimeDelta = _initialMinAllowedTimeDelta;
  }

  function setMinAllowedTimeDelta(uint48 _newMinAllowedTimeDelta) external onlyOwner {
    _checkOwner();
    _setMinAllowedTimeDelta(_newMinAllowedTimeDelta);
  }

  function _setMinAllowedTimeDelta(uint48 _newMinAllowedTimeDelta) internal {
    if (_newMinAllowedTimeDelta == 0) revert InvalidTimeDelta();
    emit MinAllowedTimeDeltaUpdated(minAllowedTimeDelta, _newMinAllowedTimeDelta);
    minAllowedTimeDelta = _newMinAllowedTimeDelta;
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

  function _checkProposalEligibility(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures)
    internal
    view
    returns (bool)
  {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    uint256 totalVoteWeight = 0;
    uint256 currentTimestamp = block.timestamp;
    uint256 oldestAllowedTimestamp = currentTimestamp - minAllowedTimeDelta;

    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[i];
      EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(perChainResp);

      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

      uint64 queryBlockTime = _ethCalls.blockTime;
      if (queryBlockTime < oldestAllowedTimestamp || queryBlockTime > currentTimestamp) revert InvalidTimestamp();

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

    // Include the hub vote weight
    uint256 hubVoteWeight = HUB_GOVERNOR.getVotes(msg.sender, block.timestamp);
    totalVoteWeight += hubVoteWeight;

    return totalVoteWeight >= HUB_GOVERNOR.proposalThreshold();
  }

  function registerSpoke(uint16 chainId, address tokenAddress) external {
    _checkOwner();
    _registerSpoke(chainId, tokenAddress);
  }

  function _registerSpoke(uint16 chainId, address spokeAddress) internal {
    if (spokeAddress == address(0)) revert ZeroTokenAddress();
    registeredSpokes[chainId] = spokeAddress;
    emit SpokeRegistered(chainId, spokeAddress);
  }

  function _extractAccountFromCalldata(bytes memory callData) internal pure returns (address) {
    // Ensure callData is long enough to contain function selector (4 bytes) and an address (20 bytes)
    if (callData.length < 24) revert InvalidCallDataLength();

    address extractedAccount;
    assembly {
      extractedAccount := mload(add(add(callData, 0x20), 4))
    }

    return extractedAccount;
  }
}
