// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVoteMocks} from "@openzeppelin/contracts/mocks/governance/GovernorVoteMock.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GovernorVoteFake is GovernorVoteMocks {
  constructor(string memory _name, ERC20Votes _token) Governor(_name) GovernorVotes(_token) {}
}
