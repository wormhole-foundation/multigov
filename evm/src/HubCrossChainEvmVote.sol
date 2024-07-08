// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
  QueryResponse,
  ParsedPerChainQueryResponse,
  ParsedQueryResponse,
  EthCallQueryResponse
} from "wormhole/query/QueryResponse.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ICrossChainVote} from "src/interfaces/ICrossChainVote.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

contract HubCrossChainEVMVote is ICrossChainVote, QueryResponse, ERC165 {
  HubVotePool immutable HUB_VOTE_POOL;

  constructor(address _core, address _hubVotePool) QueryResponse(_core) {
    HUB_VOTE_POOL = HubVotePool(_hubVotePool);
  }

  function crossChainVote(bytes memory _queryResponseRaw, IWormhole.Signature[] memory _signatures)
    external
    view
    returns (QueryVote[] memory)
  {
    // Validate the query response signatures
    ParsedQueryResponse memory _queryResponse = parseAndVerifyQueryResponse(_queryResponseRaw, _signatures);

    QueryVote[] memory queryVotes = new QueryVote[](_queryResponse.responses.length);
    for (uint256 i = 0; i < _queryResponse.responses.length; i++) {
      // Validate that the query response is from hub
      ParsedPerChainQueryResponse memory perChainResp = _queryResponse.responses[i];

      EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(perChainResp);

      // verify contract and chain is correct
      bytes32 addr = HUB_VOTE_POOL.spokeRegistry(perChainResp.chainId);
      if (addr != bytes32(uint256(uint160(_ethCalls.result[0].contractAddress))) || addr == bytes32("")) {
        revert UnknownMessageEmitter();
      }

      if (_ethCalls.result.length != 1) revert TooManyEthCallResults(i, _ethCalls.result.length);

      (uint256 proposalId, uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
        abi.decode(_ethCalls.result[0].result, (uint256, uint128, uint128, uint128));

      bytes32 _spokeProposalId = keccak256(abi.encode(perChainResp.chainId, proposalId));
      queryVotes[i] = (
        QueryVote({
          proposalId: proposalId,
          spokeProposalId: _spokeProposalId,
          proposalVote: ProposalVote(againstVotes, forVotes, abstainVotes),
          chainId: perChainResp.chainId
        })
      );
    }
    return queryVotes;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return interfaceId == type(ICrossChainVote).interfaceId || ERC165.supportsInterface(interfaceId);
  }
}
