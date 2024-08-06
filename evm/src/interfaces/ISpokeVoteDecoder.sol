// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ParsedPerChainQueryResponse} from "wormhole/query/QueryResponse.sol";

interface ISpokeVoteDecoder is IERC165 {
  struct ProposalVote {
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  struct QueryVote {
    uint256 proposalId;
    bytes32 spokeProposalId;
    ProposalVote proposalVote;
    uint16 chainId;
  }

  error TooManyEthCallResults(uint256);
  error UnknownMessageEmitter();
  error InvalidProposalVote();
  error InvalidQueryBlock(bytes);

  function decode(ParsedPerChainQueryResponse memory _queryResponse) external view returns (QueryVote memory);
}
