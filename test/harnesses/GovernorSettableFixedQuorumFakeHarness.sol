// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

import {GovernorSettableFixedQuorumFake} from "test/fakes/GovernorSettableFixedQuorumFake.sol";

contract GovernorSettableFixedQuorumFakeHarness is GovernorSettableFixedQuorumFake {
  constructor(string memory _name, ERC20Votes _token, TimelockController _timelock, uint208 _initialQuorum)
    GovernorSettableFixedQuorumFake(_name, _token, _timelock, _initialQuorum)
  {}

  function exposed_setQuorum(uint208 _amount) public {
    _setQuorum(_amount);
  }
}
