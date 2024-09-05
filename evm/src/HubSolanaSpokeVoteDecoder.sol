// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {QueryResponse} from "wormhole-sdk/QueryResponse.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {
  QueryResponse,
  ParsedPerChainQueryResponse,
  SolanaAccountQueryResponse,
  InvalidContractAddress,
  SolanaAccountResult
} from "wormhole-sdk/QueryResponse.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";

/// @title HubSolanaSpokeVoteDecoder
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the Solana `SpokeVoteAggregator`.
contract HubSolanaSpokeVoteDecoder is ISpokeVoteDecoder, QueryResponse, ERC165 {
  using BytesParsing for bytes;

  /// @notice The hub vote pool used to validate message emitter.
  HubVotePool public immutable HUB_VOTE_POOL;

  /// @notice The expected program id for the Solana program.
  bytes32 public EXPECTED_PROGRAM_ID;

  /// @notice The decimals of the token on the hub
  uint8 public HUB_TOKEN_DECIMALS;

  /// @notice The decimals of the token on solana
  uint8 public SOLANA_TOKEN_DECIMALS;

  error TooManySolanaAccountResults(uint256 resultsLength);
  error InvalidProgramId(bytes32 expectedProgramId);
  error InvalidDataLength();
  error InvalidQueryCommitment();

  /// @param _core The Wormhole core contract for the hub chain.
  /// @param _hubVotePool The address for the hub vote pool.
  /// @param _expectedProgramId The expected Solana program ID.
  constructor(address _core, address _hubVotePool, bytes32 _expectedProgramId, uint8 _solanaTokenDecimals)
    QueryResponse(_core)
  {
    HUB_VOTE_POOL = HubVotePool(_hubVotePool);
    EXPECTED_PROGRAM_ID = _expectedProgramId;
    SOLANA_TOKEN_DECIMALS = _solanaTokenDecimals;

    HubGovernor governor = HubGovernor(payable(address(HUB_VOTE_POOL.hubGovernor())));
    HUB_TOKEN_DECIMALS = IERC20Metadata(address(governor.token())).decimals();
  }

  /// @notice Decodes a parsed per chain query response for a Solana account query containing a spoke vote.
  /// @param _perChainResp The parsed per chain response.
  /// @param _governor The governor used to fetch a registered spoke.
  /// @return The parsed query vote.
  function decode(ParsedPerChainQueryResponse memory _perChainResp, IGovernor _governor)
    external
    view
    returns (QueryVote memory)
  {
    SolanaAccountQueryResponse memory _solanaAccountQueryRes = parseSolanaAccountQueryResponse(_perChainResp);

    if (_solanaAccountQueryRes.results.length != 1) {
      revert TooManySolanaAccountResults(_solanaAccountQueryRes.results.length);
    }

    _validateSolanaAccountData(_solanaAccountQueryRes.results[0]);
    _validateSolanaCommitment(_solanaAccountQueryRes);

    // Solana side returns u64 so doing the same here
    (uint256 _proposalId, uint64 _againstVotes, uint64 _forVotes, uint64 _abstainVotes) =
      abi.decode(_solanaAccountQueryRes.results[0].data, (uint256, uint64, uint64, uint64));

    uint256 _voteStart = _governor.proposalSnapshot(_proposalId);
    bytes32 _registeredAddress = HUB_VOTE_POOL.getSpoke(_perChainResp.chainId, _voteStart);

    if (_registeredAddress == bytes32("") || _solanaAccountQueryRes.results[0].account != _registeredAddress) {
      revert InvalidContractAddress();
    }

    uint256 _againstVotesScaled = _scale(_againstVotes, SOLANA_TOKEN_DECIMALS, HUB_TOKEN_DECIMALS);
    uint256 _forVotesScaled = _scale(_forVotes, SOLANA_TOKEN_DECIMALS, HUB_TOKEN_DECIMALS);
    uint256 _abstainVotesScaled = _scale(_abstainVotes, SOLANA_TOKEN_DECIMALS, HUB_TOKEN_DECIMALS);

    bytes32 _spokeProposalId = keccak256(abi.encode(_perChainResp.chainId, _proposalId));
    return (
      QueryVote({
        proposalId: _proposalId,
        spokeProposalId: _spokeProposalId,
        proposalVote: ProposalVote(_againstVotesScaled, _forVotesScaled, _abstainVotesScaled),
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

  /// @notice Validates the Solana account data
  /// @param result The Solana account result to validate
  function _validateSolanaAccountData(SolanaAccountResult memory result) internal view {
    if (result.owner != EXPECTED_PROGRAM_ID) revert InvalidProgramId(EXPECTED_PROGRAM_ID);

    // Check data length (32 bytes for uint256 + 3 * 8 bytes for three uint64 values)
    // TODO this will need to be updated to handle the proposalId type changes from the solana side (currently a u64,
    // but needs to be a uint256-like type)
    BytesParsing.checkLength(result.data, 56);
  }

  /// @notice Validates the Solana commitment (similar to finality in EVM)
  /// @param _solanaAccountQueryRes The Solana account query response to validate
  function _validateSolanaCommitment(SolanaAccountQueryResponse memory _solanaAccountQueryRes) internal pure {
    if (
      keccak256(abi.encodePacked(_solanaAccountQueryRes.requestCommitment)) != keccak256(abi.encodePacked("finalized"))
    ) revert InvalidQueryCommitment();
  }

  /// @notice Scales an amount from original decimals to target decimals
  /// @param amount The amount to scale
  /// @param fromDecimals The original decimals
  /// @param toDecimals The target decimals
  /// @return The scaled amount
  function _scale(uint256 amount, uint8 fromDecimals, uint8 toDecimals) internal pure returns (uint256) {
    if (fromDecimals == toDecimals) return amount;

    if (fromDecimals > toDecimals) return amount / (10 ** (fromDecimals - toDecimals));
    else return amount * (10 ** (toDecimals - fromDecimals));
  }
}
