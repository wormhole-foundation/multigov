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
  InvalidContractAddress,
  InvalidChainId,
  SolanaPdaQueryResponse
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

  bytes9 public constant SOLANA_COMMITMENT_LEVEL = "finalized";
  uint256 public constant DEFAULT_QUERY_VALUE = 0;
  bytes32 public constant PROPOSAL_SEED = bytes32("proposal");

  /// @notice The hub vote pool used to validate message emitter.
  HubVotePool public immutable HUB_VOTE_POOL;

  /// @notice The decimals of the token on the hub
  uint8 public HUB_TOKEN_DECIMALS;

  /// @notice The decimals of the token on solana
  uint8 public SOLANA_TOKEN_DECIMALS;

  error TooManySolanaPdaResults(uint256 resultsLength);
  error InvalidDataSlice();
  error InvalidQueryCommitment();
  error InvalidSeedsLength();
  error InvalidProposalSeed();
  error InvalidProposalIdSeed();
  error InvalidAccountOwner();
  error NoRegisteredSpokeFound();

  /// @param _core The Wormhole core contract for the hub chain.
  /// @param _hubVotePool The address for the hub vote pool.
  /// @param _solanaTokenDecimals The number of decimals for the Solana token.
  constructor(address _core, address _hubVotePool, uint8 _solanaTokenDecimals) QueryResponse(_core) {
    HUB_VOTE_POOL = HubVotePool(_hubVotePool);
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
    SolanaPdaQueryResponse memory _parsedPdaQueryRes = parseSolanaPdaQueryResponse(_perChainResp);

    // verify expected data offset and length
    if (
      _parsedPdaQueryRes.requestDataSliceOffset != DEFAULT_QUERY_VALUE
        || _parsedPdaQueryRes.requestDataSliceLength != DEFAULT_QUERY_VALUE
    ) revert InvalidDataSlice();

    // verity results length
    if (_parsedPdaQueryRes.results.length != 1) revert TooManySolanaPdaResults(_parsedPdaQueryRes.results.length);

    // verify seeds length
    if (_parsedPdaQueryRes.results[0].seeds.length != 2) revert InvalidSeedsLength();

    // verify length of each seed and value if possible
    if (
      _parsedPdaQueryRes.results[0].seeds[0].length != 8
        || bytes32(_parsedPdaQueryRes.results[0].seeds[0]) != PROPOSAL_SEED
    ) revert InvalidProposalSeed();

    // Update the commitment level check
    if (bytes9(_parsedPdaQueryRes.requestCommitment) != SOLANA_COMMITMENT_LEVEL) revert InvalidQueryCommitment();

    (uint256 _proposalId, uint64 _againstVotes, uint64 _forVotes, uint64 _abstainVotes) =
      _parseData(_parsedPdaQueryRes.results[0].data);

    if (
      _parsedPdaQueryRes.results[0].seeds[1].length != 32
        || bytes32(_parsedPdaQueryRes.results[0].seeds[1]) != bytes32(uint256(_proposalId))
    ) revert InvalidProposalIdSeed();

    // verify expected data length
    if (_parsedPdaQueryRes.results[0].data.length < 80) revert InvalidDataLength();

    // Check owner
    if (_parsedPdaQueryRes.results[0].owner != EXPECTED_PROGRAM_ID) revert InvalidAccountOwner();

    uint256 _voteStart = _governor.proposalSnapshot(_proposalId);
    bytes32 _registeredAddress = HUB_VOTE_POOL.getSpoke(_perChainResp.chainId, _voteStart);

    if (_registeredAddress == bytes32(0)) revert NoRegisteredSpokeFound();

    // Check program ID and owner based on the registered spoke address
    if (_parsedPdaQueryRes.results[0].programId != bytes32(_registeredAddress)) {
      revert InvalidProgramId(bytes32(_registeredAddress));
    }

    if (_parsedPdaQueryRes.results[0].owner != bytes32(_registeredAddress)) revert InvalidAccountOwner();

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

  // @notice Parse the vote data from a solana pda query.
  // @param _data The solana query result.
  // @return The proposals id and vote totals.
  function _parseData(bytes memory _data) internal pure returns (uint256, uint64, uint64, uint64) {
    uint256 _offset = 8; // Skip the 8-byte discriminator
    bytes32 _proposalIdBytes;
    uint64 _againstVotes;
    uint64 _forVotes;
    uint64 _abstainVotes;
    (_proposalIdBytes, _offset) = _data.asBytes32Unchecked(_offset);
    (_againstVotes, _offset) = _data.asUint64Unchecked(_offset);
    (_forVotes, _offset) = _data.asUint64Unchecked(_offset);
    (_abstainVotes,) = _data.asUint64Unchecked(_offset);
    return (uint256(_proposalIdBytes), _againstVotes, _forVotes, _abstainVotes);
  }

  /// @notice Scales an amount from original decimals to target decimals
  /// @param _amount The amount to scale
  /// @param _fromDecimals The original decimals
  /// @param _toDecimals The target decimals
  /// @return The scaled amount
  function _scale(uint256 _amount, uint8 _fromDecimals, uint8 _toDecimals) internal pure returns (uint256) {
    if (_fromDecimals == _toDecimals) return _amount;

    if (_fromDecimals > _toDecimals) return _amount / (10 ** (_fromDecimals - _toDecimals));
    else return _amount * (10 ** (_toDecimals - _fromDecimals));
  }
}
