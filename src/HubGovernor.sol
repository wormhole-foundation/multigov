// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Governor} from "@openzeppelin-contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin-contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin-contracts/governance/extensions/GovernorVotes.sol";
import {IVotes} from "@openzeppelin-contracts/governance/utils/IVotes.sol";
import {GovernorTimelockControl} from "@openzeppelin-contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin-contracts/governance/TimelockController.sol";
import {GovernorSettings} from "@openzeppelin-contracts/governance/extensions/GovernorSettings.sol";

// TODO: Add switch in Flexible Voting
contract HubGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorTimelockControl {
  constructor(
    string memory _name,
    IVotes _token,
    TimelockController _timelock,
    uint48 _initialVotingDelay,
    uint32 _initialVotingPeriod,
    uint256 _initialProposalThreshold
  )
    Governor(_name)
    GovernorSettings(_initialVotingDelay, _initialVotingPeriod, _initialProposalThreshold)
    GovernorVotes(_token)
    GovernorTimelockControl(_timelock)
  {}

  function quorum(uint256) public pure override returns (uint256) {
    return 1;
  }

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

  function proposalThreshold() public view virtual override(Governor, GovernorSettings) returns (uint256) {
    return GovernorSettings.proposalThreshold();
  }
}
