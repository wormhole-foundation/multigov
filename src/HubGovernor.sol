// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingFractional} from "flexible-voting/GovernorCountingFractional.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

contract HubGovernor is GovernorCountingFractional, GovernorSettings, GovernorVotes, GovernorTimelockControl {
  using Checkpoints for Checkpoints.Trace208;

  address public hubVotePool;

  mapping(address votingAddress => bool enabled) public trustedVotingAddresses;

  Checkpoints.Trace208 internal _quorumCheckpoints;

  constructor(
    string memory _name,
    IVotes _token,
    TimelockController _timelock,
    uint48 _initialVotingDelay,
    uint32 _initialVotingPeriod,
    uint256 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _trustedVotingAddress
  )
    Governor(_name)
    GovernorSettings(_initialVotingDelay, _initialVotingPeriod, _initialProposalThreshold)
    GovernorVotes(_token)
    GovernorTimelockControl(_timelock)
  {
    _enableTrustedVotingAddress(_trustedVotingAddress);
    _setQuorum(_initialQuorum);
  }

  function enableTrustedVotingAddress(address _hubVotePool) external {
    _checkGovernance();
    _enableTrustedVotingAddress(_hubVotePool);
  }

  function disableTrustedVotingAddress(address _trustedAddress) external {
    _checkGovernance();
    _disableTrustedVotingAddress(_trustedAddress);
  }

  function quorum(uint256 _voteStart) public view override returns (uint256) {
    return _quorumCheckpoints.upperLookup(SafeCast.toUint48(_voteStart));
  }

  function setQuorum(uint208 _amount) external {
    _checkGovernance();
    _setQuorum(_amount);
  }

  function _setQuorum(uint208 _amount) internal {
    _quorumCheckpoints.push(SafeCast.toUint48(block.timestamp), _amount);
  }

  function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
    internal
    virtual
    override(Governor, GovernorTimelockControl)
    returns (uint256)
  {
    return GovernorTimelockControl._cancel(targets, values, calldatas, descriptionHash);
  }

  function _disableTrustedVotingAddress(address _trustedAddress) internal {
    trustedVotingAddresses[_trustedAddress] = false;
  }

  function _enableTrustedVotingAddress(address _trustedAddress) internal {
    trustedVotingAddresses[_trustedAddress] = true;
  }

  function _executeOperations(
    uint256 _proposalId,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    bytes32 _descriptionHash
  ) internal virtual override(Governor, GovernorTimelockControl) {
    GovernorTimelockControl._executeOperations(_proposalId, _targets, _values, _calldatas, _descriptionHash);
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

  function _countVote(uint256 proposalId, address account, uint8 support, uint256 totalWeight, bytes memory voteData)
    internal
    virtual
    override(Governor, GovernorCountingFractional)
  {
    if (account != hubVotePool) {
      require(totalWeight > 0, "GovernorCountingFractional: no weight");
      if (voteWeightCast(proposalId, account) >= totalWeight) revert("GovernorCountingFractional: all weight cast");
    }

    uint128 safeTotalWeight = SafeCast.toUint128(totalWeight);

    if (voteData.length == 0) _countVoteNominal(proposalId, account, safeTotalWeight, support);
    else _countVoteFractional(proposalId, account, safeTotalWeight, voteData);
  }
}
