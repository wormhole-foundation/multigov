// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVoteMocks} from "@openzeppelin/contracts/mocks/governance/GovernorVoteMock.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract GovernorVoteFake is GovernorVoteMocks, GovernorTimelockControl {
  constructor(string memory _name, ERC20Votes _token, TimelockController _timelock)
    Governor(_name)
    GovernorVotes(_token)
    GovernorTimelockControl(_timelock)
  {}

  function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
    internal
    virtual
    override(Governor, GovernorTimelockControl)
    returns (uint256)
  {
    return GovernorTimelockControl._cancel(targets, values, calldatas, descriptionHash);
  }

  function _executeOperations(
    uint256, /* proposalId */
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 /*descriptionHash*/
  ) internal virtual override(Governor, GovernorTimelockControl) {
    GovernorTimelockControl._executeOperations(0, targets, values, calldatas, 0);
  }

  function _executor() internal view virtual override(Governor, GovernorTimelockControl) returns (address) {
    return GovernorTimelockControl._executor();
  }

  function _queueOperations(
    uint256 _proposalId, /*proposalId*/
    address[] memory _targets, /*targets*/
    uint256[] memory _values, /*values*/
    bytes[] memory _calldatas, /*calldatas*/
    bytes32 _description /*descriptionHash*/
  ) internal virtual override(Governor, GovernorTimelockControl) returns (uint48) {
    return GovernorTimelockControl._queueOperations(_proposalId, _targets, _values, _calldatas, _description);
  }

  function proposalNeedsQueuing(uint256 proposalId)
    public
    view
    virtual
    override(Governor, GovernorTimelockControl)
    returns (bool)
  {
    return GovernorTimelockControl.proposalNeedsQueuing(proposalId);
  }

  function state(uint256 proposalId)
    public
    view
    virtual
    override(Governor, GovernorTimelockControl)
    returns (ProposalState)
  {
    return GovernorTimelockControl.state(proposalId);
  }
}
