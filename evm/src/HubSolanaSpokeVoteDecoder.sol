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
/// @dev This contract handles decimal scaling to match the hub chain's decimals when decoding votes from Solana.
contract HubSolanaSpokeVoteDecoder is ISpokeVoteDecoder, QueryResponse, ERC165 {
  using BytesParsing for bytes;

  bytes9 public constant SOLANA_COMMITMENT_LEVEL = "finalized";
  uint256 public constant DEFAULT_QUERY_VALUE = 0;
  bytes32 public constant PROPOSAL_SEED = bytes32("proposal");
  bytes8 public constant PROPOSAL_DISCRIMINATOR = bytes8(sha256("account:ProposalData"));

  /// @notice The hub vote pool used to validate message emitter.
  HubVotePool public immutable HUB_VOTE_POOL;

  /// @notice The decimals of the token on the hub
  uint8 public immutable HUB_TOKEN_DECIMALS;

  /// @notice The decimals of the token on Solana (typically 6 for SPL tokens)
  /// @dev Used to scale vote amounts from Solana to match the hub chain's decimal precision
  uint8 public immutable SOLANA_TOKEN_DECIMALS;

  error TooManySolanaPdaResults(uint256 resultsLength);
  error InvalidDataSlice();
  error InvalidProgramId(bytes32 expectedProgramId);
  error InvalidQueryCommitment();
  error InvalidSeedsLength();
  error InvalidProposalSeed();
  error InvalidProposalIdSeed(bytes32 expected, bytes32 actual);
  error InvalidAccountOwner();
  error SpokeNotRegistered();
  error InvalidDiscriminator();

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

    // verify length of each seed and value
    if (
      _parsedPdaQueryRes.results[0].seeds[0].length != 8
        || bytes32(_parsedPdaQueryRes.results[0].seeds[0]) != PROPOSAL_SEED
    ) revert InvalidProposalSeed();

    // verify commitment level length and value
    _parsedPdaQueryRes.requestCommitment.checkLength(9);
    if (bytes9(_parsedPdaQueryRes.requestCommitment) != SOLANA_COMMITMENT_LEVEL) revert InvalidQueryCommitment();

    (bytes32 _proposalIdBytes, uint64 _againstVotes, uint64 _forVotes, uint64 _abstainVotes,) =
      _parseData(_parsedPdaQueryRes.results[0].data);

    if (
      _parsedPdaQueryRes.results[0].seeds[1].length != 32
        || bytes32(_parsedPdaQueryRes.results[0].seeds[1]) != _proposalIdBytes
    ) revert InvalidProposalIdSeed(_proposalIdBytes, bytes32(_parsedPdaQueryRes.results[0].seeds[1]));

    uint256 _proposalIdUint = uint256(_proposalIdBytes);
    uint256 _voteStart = _governor.proposalSnapshot(_proposalIdUint);
    bytes32 _registeredAddress = HUB_VOTE_POOL.getSpoke(_perChainResp.chainId, _voteStart);

    if (_registeredAddress == bytes32(0)) revert SpokeNotRegistered();

    // Check program ID and owner based on the registered spoke address
    if (_parsedPdaQueryRes.results[0].programId != _registeredAddress) revert InvalidProgramId(_registeredAddress);

    if (_parsedPdaQueryRes.results[0].owner != _registeredAddress) revert InvalidAccountOwner();

    uint256 _againstVotesScaled = _scale(_againstVotes, SOLANA_TOKEN_DECIMALS, HUB_TOKEN_DECIMALS);
    uint256 _forVotesScaled = _scale(_forVotes, SOLANA_TOKEN_DECIMALS, HUB_TOKEN_DECIMALS);
    uint256 _abstainVotesScaled = _scale(_abstainVotes, SOLANA_TOKEN_DECIMALS, HUB_TOKEN_DECIMALS);

    return (
      QueryVote({
        proposalId: _proposalIdUint,
        spokeProposalId: keccak256(abi.encode(_perChainResp.chainId, _proposalIdUint)),
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
  function _parseData(bytes memory _data) internal pure returns (bytes32, uint64, uint64, uint64, uint64) {
    uint256 _offset = 0;
    bytes8 _discriminator;
    bytes32 _proposalIdBytes;
    uint64 _againstVotes;
    uint64 _forVotes;
    uint64 _abstainVotes;
    uint64 _voteStart;

    (_discriminator, _offset) = _data.asBytes8Unchecked(_offset);
    if (_discriminator != PROPOSAL_DISCRIMINATOR) revert InvalidDiscriminator();

    (_proposalIdBytes, _offset) = _data.asBytes32Unchecked(_offset);
    (_againstVotes, _offset) = _data.asUint64Unchecked(_offset);
    (_forVotes, _offset) = _data.asUint64Unchecked(_offset);
    (_abstainVotes, _offset) = _data.asUint64Unchecked(_offset);
    (_voteStart, _offset) = _data.asUint64Unchecked(_offset);

    // Verify the total length of the data (72 bytes)
    _data.checkLength(_offset);

    return
      (_proposalIdBytes, _reverse(_againstVotes), _reverse(_forVotes), _reverse(_abstainVotes), _reverse(_voteStart));
  }

  /// @notice Scales an amount from original decimals to target decimals
  /// @param _amount The amount to scale
  /// @param _fromDecimals The original decimals
  /// @param _toDecimals The target decimals
  /// @return The scaled amount
  function _scale(uint256 _amount, uint8 _fromDecimals, uint8 _toDecimals) internal pure returns (uint256) {
    if (_fromDecimals == _toDecimals) return _amount;

    if (_fromDecimals > _toDecimals) return _amount / (10 ** (_fromDecimals - _toDecimals));
    return _amount * (10 ** (_toDecimals - _fromDecimals));
  }

  /// @notice Reverse the endianness of the passed in integer.
  /// @param _input The integer for which to reverse the endianess.
  /// @return An integer with the endianness reversed.
  /// @dev This code was copied from
  /// https://github.com/wormholelabs-xyz/example-queries-solana-pda/blob/4a01a0a6018b36a1d38d326362bfb672c5061c5f/src/OwnerVerifier.sol#L52.
  function _reverse(uint64 _input) internal pure returns (uint64) {
    uint64 v = _input;
    unchecked {
      // swap bytes
      v = ((v & 0xFF00FF00FF00FF00) >> 8) | ((v & 0x00FF00FF00FF00FF) << 8);
      // swap 2-byte long pairs
      v = ((v & 0xFFFF0000FFFF0000) >> 16) | ((v & 0x0000FFFF0000FFFF) << 16);
      // swap 4-byte long pairs
      v = (v >> 32) | (v << 32);
    }
    return v;
  }
}
