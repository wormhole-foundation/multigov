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
  InvalidChainId,
  SolanaAccountResult,
  SolanaPdaResult,
  SolanaPdaQueryResponse
} from "wormhole-sdk/QueryResponse.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";
import {Test, console} from "forge-std/Test.sol";

/// @title HubSolanaSpokeVoteDecoder
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the Solana `SpokeVoteAggregator`.
contract HubSolanaSpokeVoteDecoder is ISpokeVoteDecoder, QueryResponse, ERC165 {
  using BytesParsing for bytes;

  uint16 public constant SOLANA_CHAIN_ID = 1;
  bytes12 public constant SOLANA_COMMITMENT_LEVEL = "finalized";
  uint256 public constant DEFAULT_QUERY_VALUE = 0;
  bytes32 public constant PROPOSAL_SEED = bytes32("proposal");
  // 48 bytes
  // 5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ program id
  // check proposal id, proposal seed
  // "proposal"
  // Create testing

  /// @notice The hub vote pool used to validate message emitter.
  HubVotePool public immutable HUB_VOTE_POOL;

  /// @notice The expected program id for the Solana program.
  bytes32 public immutable EXPECTED_PROGRAM_ID;

  /// @notice The decimals of the token on the hub
  uint8 public HUB_TOKEN_DECIMALS;

  /// @notice The decimals of the token on solana
  uint8 public SOLANA_TOKEN_DECIMALS;

  error TooManySolanaPdaResults(uint256 resultsLength);
  error InvalidProgramId(bytes32 expectedProgramId);
  error InvalidDataLength();
  error InvalidDataSlice();
  error InvalidQueryCommitment();
  error InvalidSeedsLength();
  error InvalidProposalSeed();
  error InvalidProposalIdSeed();
  error InvalidAccountOwner();

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
    SolanaPdaQueryResponse memory _parsedPdaQueryRes = parseSolanaPdaQueryResponse(_perChainResp);

    // verify chain id is solana
    if (_perChainResp.chainId != SOLANA_CHAIN_ID) revert InvalidChainId();
    // verify expected data offset and length
    if (
      _parsedPdaQueryRes.requestDataSliceOffset != DEFAULT_QUERY_VALUE
        || _parsedPdaQueryRes.requestDataSliceLength != DEFAULT_QUERY_VALUE
    ) revert InvalidDataSlice();
    // verity results length
    if (_parsedPdaQueryRes.results.length != 1) revert TooManySolanaPdaResults(_parsedPdaQueryRes.results.length);

    // verify program id
    if (_parsedPdaQueryRes.results[0].programId != EXPECTED_PROGRAM_ID) revert InvalidProgramId(_parsedPdaQueryRes.results[0].programId);

    // verify seeds length
    if (_parsedPdaQueryRes.results[0].seeds.length != 2) revert InvalidSeedsLength();

    // verify length of each seed and value if possible
    if (
      _parsedPdaQueryRes.results[0].seeds[0].length != 8
        || bytes32(_parsedPdaQueryRes.results[0].seeds[0]) != PROPOSAL_SEED
    ) revert InvalidProposalSeed();

    if (bytes12(_parsedPdaQueryRes.requestCommitment) != SOLANA_COMMITMENT_LEVEL) revert InvalidQueryCommitment();

    // TODO: Solana side returns u64 so doing the same here
    (uint256 _proposalId, uint64 _againstVotes, uint64 _forVotes, uint64 _abstainVotes) =
      _parseData(_parsedPdaQueryRes.results[0].data);

    if (
      _parsedPdaQueryRes.results[0].seeds[1].length != 32
        || bytes32(_parsedPdaQueryRes.results[0].seeds[1]) != bytes32(uint256(_proposalId))
    ) revert InvalidProposalIdSeed();

    // verify expected data length needs to be changed to 48 in the future
    _parsedPdaQueryRes.results[0].data.checkLength(56);

    // Check owner
    // TODO: what is the address to check here. This may need to be changed
    if (_parsedPdaQueryRes.results[0].owner != EXPECTED_PROGRAM_ID) revert InvalidAccountOwner();

    uint256 _voteStart = _governor.proposalSnapshot(_proposalId);
    bytes32 _registeredAddress = HUB_VOTE_POOL.getSpoke(_perChainResp.chainId, _voteStart);

    if (_registeredAddress == bytes32("") || _parsedPdaQueryRes.results[0].account != _registeredAddress) {
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

  //(_proposalId, _offset) = _parsedPdaQueryRes.results[0].data.asUint64Unchecked(_offset);
  function _parseData(bytes memory _data) internal pure returns (uint256, uint64, uint64, uint64) {
    uint256 _offset = 0;
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
