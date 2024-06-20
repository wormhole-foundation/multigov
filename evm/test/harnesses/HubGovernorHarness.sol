// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

import {HubGovernor} from "src/HubGovernor.sol";

contract HubGovernorHarness is HubGovernor {
  constructor(
    string memory _name,
    IVotes _token,
    TimelockController _timelock,
    uint48 _initialVotingDelay,
    uint32 _initialVotingPeriod,
    uint256 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _hubVotePool
  )
    HubGovernor(
      _name,
      _token,
      _timelock,
      _initialVotingDelay,
      _initialVotingPeriod,
      _initialProposalThreshold,
      _initialQuorum,
      _hubVotePool
    )
  {}

  function exposed_setQuorum(uint208 _amount) public {
    _setQuorum(_amount);
  }

  function exposed_countVote(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    uint256 _totalWeight,
    bytes memory _voteData
  ) public {
    _countVote(_proposalId, _account, _support, _totalWeight, _voteData);
  }

  function exposed_enableWhitelistedAddress(address _whitelistedAddress) public {
    _enableWhitelistedVotingAddress(_whitelistedAddress);
  }

  function exposed_setWhitelistedProposer(address _proposer) public {
    _setWhitelistedProposer(_proposer);
  }
}
