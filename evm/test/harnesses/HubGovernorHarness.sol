// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

import {HubGovernor} from "src/HubGovernor.sol";

contract HubGovernorHarness is HubGovernor {
  constructor(HubGovernor.ConstructorParams memory params) HubGovernor(params) {}

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

  function exposed_setHubVotePool(address _hubVotePool) public {
    _setHubVotePool(_hubVotePool);
  }

  function exposed_setWhitelistedProposer(address _proposer) public {
    _setWhitelistedProposer(_proposer);
  }

  function exposed_getVotes(address _account, uint256 _timepoint) public view returns (uint256) {
    return _getVotes(_account, _timepoint, bytes(""));
  }

  function exposed_setVoteWeightWindow(uint48 _num) public {
    _setVoteWeightWindow(_num);
  }
}
