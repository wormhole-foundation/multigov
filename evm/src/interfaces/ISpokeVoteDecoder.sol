// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {ParsedPerChainQueryResponse} from "wormhole-sdk/QueryResponse.sol";

interface ISpokeVoteDecoder is IERC165 {
  struct ProposalVote {
    uint256 againstVotes;
    uint256 forVotes;
    uint256 abstainVotes;
  }

  struct QueryVote {
    uint256 proposalId;
    bytes32 spokeProposalId;
    ProposalVote proposalVote;
    uint16 chainId;
  }

  error TooManyEthCallResults(uint256);
  error InvalidProposalVote();
  error InvalidQueryBlock(bytes);

  function decode(ParsedPerChainQueryResponse memory _queryResponse, IGovernor _governor)
    external
    view
    returns (QueryVote memory);
}
