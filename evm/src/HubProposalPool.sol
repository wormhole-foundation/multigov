// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

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

  error EmptyProposal();
  error InsufficientVoteWeight();
  error InvalidProposalLength();
  error InvalidTokenAddress(uint16 chainId, address tokenAddress);
  error NoEthCallResults();
  error TooManyEthCallResults(uint256);
  error ZeroTokenAddress();

  event ProposalCreated(uint256 proposalId);
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
    if (targets.length != values.length || targets.length != calldatas.length) revert InvalidProposalLength();
    if (targets.length == 0) revert EmptyProposal();

    bool isEligible = _checkProposalEligibility(_queryResponseRaw, _signatures);
    if (!isEligible) revert InsufficientVoteWeight();

    uint256 proposalId = HUB_GOVERNOR.propose(targets, values, calldatas, description);

    emit ProposalCreated(proposalId);
    return proposalId;
  }

  function _checkProposalEligibility(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures)
    internal
    view
    returns (bool)
  {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    uint256 totalVoteWeight = 0;
    uint256 numResponses = _queryResponse.responses.length;

    for (uint256 i = 0; i < numResponses; i++) {
      ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[i];
      EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(perChainResp);

      // Verify that the token address in the query matches what we have registered
      address registeredTokenAddress = tokenAddresses[perChainResp.chainId];
      if (registeredTokenAddress == address(0)) revert InvalidTokenAddress(perChainResp.chainId, address(0));

      // Parse the request to check if the request address matches the registered token address
      address queriedAddress = _ethCalls.result[0].contractAddress;
      if (queriedAddress != registeredTokenAddress) revert InvalidTokenAddress(perChainResp.chainId, queriedAddress);

      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);
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
}
