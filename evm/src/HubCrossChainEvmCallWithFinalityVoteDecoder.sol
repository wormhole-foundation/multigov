// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
  QueryResponse,
  ParsedPerChainQueryResponse,
  EthCallWithFinalityQueryResponse
} from "wormhole/query/QueryResponse.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ICrossChainVoteDecoder} from "src/interfaces/ICrossChainVoteDecoder.sol";

/// @title HubCrossChainEvmCallWithFinalityVoteDecoder
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the `SpokeVoteAggregator`.
contract HubCrossChainEvmCallWithFinalityVoteDecoder is ICrossChainVoteDecoder, QueryResponse, ERC165 {
  /// @notice The hub vote pool used to validate message emitter.
  HubVotePool public immutable HUB_VOTE_POOL;

  /// @param _core The Wormhole core contract for the hub chain.
  /// @param _hubVotePool The address for the hub vote pool.
  constructor(address _core, address _hubVotePool) QueryResponse(_core) {
    HUB_VOTE_POOL = HubVotePool(_hubVotePool);
  }

  /// @notice Decodes a parsed per chain query respone for an eth call with finality query containing a spoke vote.
  /// @param _perChainResp The parsed per chain response.
  /// @return The parsed query vote.
  function decode(ParsedPerChainQueryResponse memory _perChainResp) external view returns (QueryVote memory) {
    EthCallWithFinalityQueryResponse memory _ethCalls = parseEthCallWithFinalityQueryResponse(_perChainResp);
    if (keccak256(_ethCalls.requestFinality) != keccak256(bytes("finalized"))) {
      revert InvalidQueryBlock(_ethCalls.requestBlockId);
    }

    // verify contract and chain is correct
    bytes32 addr = HUB_VOTE_POOL.spokeRegistry(_perChainResp.chainId);
    bool isValidSpokeAddress = _isValidSpokeAddress(addr, _ethCalls.result[0].contractAddress);
    if (!isValidSpokeAddress) revert UnknownMessageEmitter();

    if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

    (uint256 proposalId, uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
      abi.decode(_ethCalls.result[0].result, (uint256, uint128, uint128, uint128));

    bytes32 _spokeProposalId = keccak256(abi.encode(_perChainResp.chainId, proposalId));
    return (
      QueryVote({
        proposalId: proposalId,
        spokeProposalId: _spokeProposalId,
        proposalVote: ProposalVote(againstVotes, forVotes, abstainVotes),
        chainId: _perChainResp.chainId
      })
    );
  }

  /// @notice An ERC165 compatible method that validates the various interfaces this contract supports.
  /// @param _interfaceId The id of the interface that is checked.
  /// @return Whether the interface id is supported.
  function supportsInterface(bytes4 _interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return _interfaceId == type(ICrossChainVoteDecoder).interfaceId || ERC165.supportsInterface(_interfaceId);
  }

  /// @notice A helper function to compare a registered spoke address to the address in the query.
  /// @param _registeredSpokeAddress The wormhole representation of a registered address.
  /// @param _queriedContract An ethereum address used in the query.
  function _isValidSpokeAddress(bytes32 _registeredSpokeAddress, address _queriedContract) internal pure returns (bool) {
    if (
      _registeredSpokeAddress != bytes32(uint256(uint160(_queriedContract))) || _registeredSpokeAddress == bytes32("")
    ) return false;
    return true;
  }
}
