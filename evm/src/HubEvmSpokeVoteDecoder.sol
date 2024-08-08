// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
  QueryResponse,
  ParsedPerChainQueryResponse,
  EthCallData,
  EthCallWithFinalityQueryResponse,
  InvalidContractAddress,
  InvalidFunctionSignature
} from "wormhole-sdk/QueryResponse.sol";
import {fromWormholeFormat} from "wormhole-sdk/Utils.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";

/// @title HubEvmSpokeVoteDecoder
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the `SpokeVoteAggregator`.
contract HubEvmSpokeVoteDecoder is ISpokeVoteDecoder, QueryResponse, ERC165 {
  using BytesParsing for bytes;

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

    // verify contract and chain is correct
    if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

    _validateEthCallData(_perChainResp.chainId, _ethCalls.result[0]);
    if (keccak256(_ethCalls.requestFinality) != keccak256(bytes("finalized"))) {
      revert InvalidQueryBlock(_ethCalls.requestBlockId);
    }

    _ethCalls.result[0].result.checkLength(128);
    (uint256 _proposalId, uint128 _againstVotes, uint128 _forVotes, uint128 _abstainVotes) =
      abi.decode(_ethCalls.result[0].result, (uint256, uint128, uint128, uint128));

    bytes32 _spokeProposalId = keccak256(abi.encode(_perChainResp.chainId, _proposalId));
    return (
      QueryVote({
        proposalId: _proposalId,
        spokeProposalId: _spokeProposalId,
        proposalVote: ProposalVote(_againstVotes, _forVotes, _abstainVotes),
        chainId: _perChainResp.chainId
      })
    );
  }

  /// @notice An ERC165 compatible method that validates the various interfaces this contract supports.
  /// @param _interfaceId The id of the interface that is checked.
  /// @return Whether the interface id is supported.
  function supportsInterface(bytes4 _interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return _interfaceId == type(ISpokeVoteDecoder).interfaceId || ERC165.supportsInterface(_interfaceId);
  }

  /// @notice Validate the query eth calldata was from the expected spoke contract and contains the expected function
  /// signature.
  /// @param _chainId The wormhole chain id of the query.
  /// @param _r The Eth calldata of the query.
  function _validateEthCallData(uint16 _chainId, EthCallData memory _r) internal view {
    bytes32 _registeredAddress = HUB_VOTE_POOL.spokeRegistry(_chainId);
    if (_registeredAddress == bytes32("") || _r.contractAddress != fromWormholeFormat(_registeredAddress)) {
      revert InvalidContractAddress();
    }
    (bytes4 funcSig,) = _r.callData.asBytes4Unchecked(0);
    // The function signature should be bytes4(keccak256(bytes("proposalVotes(uint256)")))
    if (funcSig != bytes4(hex"544ffc9c")) revert InvalidFunctionSignature();
  }
}
