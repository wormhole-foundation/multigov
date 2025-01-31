// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubEvmSpokeVoteDecoder} from "src/HubEvmSpokeVoteDecoder.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryResponse, ParsedQueryResponse} from "wormhole-sdk/QueryResponse.sol";
import {Checkpoints} from "src/lib/Checkpoints.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title HubVotePool
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that parses a specific wormhole query type from the `SpokeVoteAggregator`.
contract WVoteVerifier is QueryResponse {
  /// @notice The governor where cross chain votes are submitted.
  IGovernor public hubGovernor;

  /// @dev Contains the distribution of a proposal vote.
  struct SupplyOnSpokes {
    mapping(uint16 => uint256) chainIdSupply;
    uint16[] chainIds;
    uint256 supplySum; 
  }

  mapping (uint64 => SupplyOnSpokes) proposalSupply;

  uint256 immutable totalSupply;

  constructor(address _core, address _hubGovernor, uint256 _totalSupply) QueryResponse(_core) {
    _setGovernor(_hubGovernor);
    totalSupply = _totalSupply;
  }

  function verifyVotes(uint64 proposalId, uint16 chainId, uint256 totalVotes) public {
    SupplyOnSpokes storage supply = proposalSupply[proposalId];

    if (totalVotes > supply.chainIdSupply[chainId]) {
        revert("Supply on chain X exceeded")
    }
  }

  function registerSupplyForProposal(uint64 proposalId, bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures) {
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);
    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      ISpokeVoteDecoder.QueryVote memory _voteQuery = _voteQueryImpl.decode(_queryResponse.responses[i], hubGovernor);
      ISpokeVoteDecoder.ProposalVote memory _proposalVote = _voteQuery.proposalVote;
      ProposalVote memory _existingSpokeVote = spokeProposalVotes[_voteQuery.spokeProposalId];
    }

    // Check that we've delivered the supply from every EVM spokes
    // If we have then we can calculate the Solana spoke weight
    SupplyOnSpokes storage _proposalSupply = proposalSupply[chainId];
    if (HUB_VOTE_POOL.getNumSpokes(_voteStart) == _proposalSupply.chainIds.length - 1) {
        _proposalSupply.chainIdSupply[1] = totalSupply - _proposalSupply.supplySum;
    }
  }

  function decode(ParsedPerChainQueryResponse memory _perChainResp, IGovernor _governor)
    external
    view
    returns (QueryVote memory)
  {
    EthCallWithFinalityQueryResponse memory _ethCalls = parseEthCallWithFinalityQueryResponse(_perChainResp);

    // verify contract and chain is correct
    if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

    _validateEthCallData(_ethCalls.result[0]);
    _ethCalls.requestFinality.checkLength(9);
    if (bytes9(_ethCalls.requestFinality) != REQUEST_FINALITY) revert InvalidQueryBlock(_ethCalls.requestBlockId);

    _ethCalls.result[0].result.checkLength(128);
    (uint256 _totalSupply) = abi.decode(_ethCalls.result[0].result, (uint256));

    uint256 _voteStart = _governor.proposalSnapshot(_proposalId);
    bytes32 _registeredAddress = HUB_VOTE_POOL.getSpoke(_perChainResp.chainId, _voteStart);
    if (
      _registeredAddress == bytes32("") || _ethCalls.result[0].contractAddress != fromWormholeFormat(_registeredAddress)
    ) revert InvalidContractAddress();

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

  /// @notice Validate the query eth calldata was from the expected spoke contract and contains the expected function
  /// signature.
  /// @param _r The Eth calldata of the query.
  function _validateEthCallData(EthCallData memory _r) internal pure {
    (bytes4 funcSig,) = _r.callData.asBytes4Unchecked(0);
    // The function signature should be bytes4(keccak256(bytes("proposalVotes(uint256)")))
    if (funcSig != bytes4(hex"544ffc9c")) revert InvalidFunctionSignature();
  }



  function _setGovernor(address _newGovernor) internal {
    emit HubGovernorUpdated(address(hubGovernor), _newGovernor);
    hubGovernor = IGovernor(_newGovernor);
  }
}
