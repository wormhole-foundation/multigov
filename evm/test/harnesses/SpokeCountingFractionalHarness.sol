// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";

contract SpokeCountingFractionalHarness is SpokeCountingFractional {
  function workaround_createProposalVote(
    uint256 proposalId,
    address account,
    uint8 support,
    uint256 totalWeight,
    bytes memory voteData
  ) external {
    _countVote(proposalId, account, support, totalWeight, voteData);
  }

  function exposed_countVote(
    uint256 proposalId,
    address account,
    uint8 support,
    uint256 totalWeight,
    bytes memory voteData
  ) public {
    _countVote(proposalId, account, support, totalWeight, voteData);
  }

  function exposed_countVoteNominal(uint256 proposalId, address account, uint128 totalWeight, uint8 support) public {
    _countVoteNominal(proposalId, account, totalWeight, support);
  }

  function exposed_countVoteFractional(uint256 proposalId, address account, uint128 totalWeight, bytes memory voteData)
    public
  {
    _countVoteFractional(proposalId, account, totalWeight, voteData);
  }

  function exposed_decodePackedVotes(bytes memory voteData)
    public
    pure
    returns (uint128 againstVotes, uint128 forVotes, uint128 abstainVotes)
  {
    return _decodePackedVotes(voteData);
  }
}
