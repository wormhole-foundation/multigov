// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ParsedPerChainQueryResponse} from "wormhole/query/QueryResponse.sol";

interface ICrossChainVoteWeight is IERC165 {
  struct CrossChainVoteWeightResult {
    uint256 voteWeight;
    uint64 blockTime;
  }

  error InvalidCalldataLength();
  error InvalidCaller(address expected, address actual);
  error TooManyEthCallResults(uint256 numResults);

  function getVoteWeight(ParsedPerChainQueryResponse memory _perChainResp)
    external
    view
    returns (CrossChainVoteWeightResult memory);
}
