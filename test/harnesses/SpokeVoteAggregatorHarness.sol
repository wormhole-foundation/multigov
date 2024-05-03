// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";

contract SpokeVoteAggregatorHarness is SpokeVoteAggregator {
  constructor(
    address _core,
    uint16 _hubChainId,
    address _hubProposalMetadataSender,
    address _votingToken,
    uint32 _safeWindow,
    address _owner
  ) SpokeVoteAggregator(_core, _hubChainId, _hubProposalMetadataSender, _votingToken, _safeWindow, _owner) {}

  function workaround_createProposal(uint256 _proposalId, uint256 _voteStart, uint256 _voteEnd) public {
    proposals[_proposalId] = Proposal({voteStart: _voteStart, voteEnd: _voteEnd});
  }

  function exposed_setSafeWindow(uint32 _safeWindow) public {
    _setSafeWindow(_safeWindow);
  }
}
