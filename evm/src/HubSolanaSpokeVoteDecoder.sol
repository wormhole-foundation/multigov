// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {QueryResponse} from "wormhole-sdk/QueryResponse.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
  QueryResponse,
  ParsedPerChainQueryResponse,
  SolanaAccountQueryResponse,
  InvalidContractAddress,
  SolanaAccountResult
} from "wormhole-sdk/QueryResponse.sol";
import {fromWormholeFormat} from "wormhole-sdk/Utils.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";

contract HubSolanaSpokeVoteDecoder is ISpokeVoteDecoder, QueryResponse, ERC165 {
  using BytesParsing for bytes;

  /// @notice The hub vote pool used to validate message emitter.
  HubVotePool public immutable HUB_VOTE_POOL;

  /// @notice The expected program id for the Solana program.
  bytes32 public EXPECTED_PROGRAM_ID;

  error TooManySolanaAccountResults(uint256 resultsLength);
  error InvalidProgramId(bytes32 expectedProgramId);
  error InvalidDataLength();
  error InvalidQueryCommitment();

  constructor(address _core, address _hubVotePool, bytes32 _expectedProgramId) QueryResponse(_core) {
    HUB_VOTE_POOL = HubVotePool(_hubVotePool);
    EXPECTED_PROGRAM_ID = _expectedProgramId;
  }

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

    // TODO need to get the solana side to align with the `SpokeVoteAggregator` `proposalVotes` function return type,
    // which includes proposalId
    uint256 _proposalId = 0;

    // Solana side returns u64 so doing the same here
    (uint64 _againstVotes, uint64 _forVotes, uint64 _abstainVotes) =
      abi.decode(_solanaAccountQueryRes.results[0].data, (uint64, uint64, uint64));

    uint256 _voteStart = _governor.proposalSnapshot(_proposalId);
    bytes32 _registeredAddress = HUB_VOTE_POOL.getSpoke(_perChainResp.chainId, _voteStart);

    if (_registeredAddress == bytes32("") || _solanaAccountQueryRes.results[0].account != _registeredAddress) {
      revert InvalidContractAddress();
    }

    bytes32 _spokeProposalId = keccak256(abi.encode(_perChainResp.chainId, _proposalId));
    return (
      QueryVote({
        proposalId: _proposalId,
        spokeProposalId: _spokeProposalId,
        proposalVote: ProposalVote(uint256(_againstVotes), uint256(_forVotes), uint256(_abstainVotes)),
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

  function _validateSolanaAccountData(SolanaAccountResult memory result) internal view {
    // Check if the account is owned by the expected program
    if (result.owner != EXPECTED_PROGRAM_ID) revert InvalidProgramId(EXPECTED_PROGRAM_ID);

    // Check data length (3 * 8 bytes for three u64 values)
    if (result.data.length != 24) revert InvalidDataLength();
  }

  function _validateSolanaCommitment(SolanaAccountQueryResponse memory _solanaAccountQueryRes) internal pure {
    if (
      keccak256(abi.encodePacked(_solanaAccountQueryRes.requestCommitment)) != keccak256(abi.encodePacked("finalized"))
    ) revert InvalidQueryCommitment();
  }
}
