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

contract HubProposalPool is QueryResponse, Ownable {
  IGovernor public immutable HUB_GOVERNOR;
  IWormhole public immutable WORMHOLE_CORE;

  mapping(uint16 => address) public tokenAddresses;

  error InsufficientVoteWeight();
  error InvalidCallDataLength();
  error InvalidCaller(address expected, address actual);
  error InvalidTokenAddress(uint16 chainId, address tokenAddress);
  error TooManyEthCallResults(uint256);
  error ZeroTokenAddress();

  event TokenAddressSet(uint16 chainId, address tokenAddress);

  constructor(address _core, address _hubGovernor) QueryResponse(_core) Ownable(_hubGovernor) {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_GOVERNOR = IGovernor(_hubGovernor);
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

    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      // TODO: need to check that the query time is a reasonalbe time against the hub time; reflect current state mostly
      ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[i];
      EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(perChainResp);
      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

      // Verify that the token address in the query matches what we have registered
      address registeredTokenAddress = tokenAddresses[perChainResp.chainId];
      if (registeredTokenAddress == address(0)) revert InvalidTokenAddress(perChainResp.chainId, address(0));

      // Parse the request to check if the request address matches the registered token address
      address queriedAddress = _ethCalls.result[0].contractAddress;
      if (queriedAddress != registeredTokenAddress) revert InvalidTokenAddress(perChainResp.chainId, queriedAddress);

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

  function setTokenAddress(uint16 chainId, address tokenAddress) external {
    _checkOwner();
    _setTokenAddress(chainId, tokenAddress);
  }

  function _setTokenAddress(uint16 chainId, address tokenAddress) internal {
    if (tokenAddress == address(0)) revert ZeroTokenAddress();
    tokenAddresses[chainId] = tokenAddress;
    emit TokenAddressSet(chainId, tokenAddress);
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
