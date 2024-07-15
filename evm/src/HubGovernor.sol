// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {IERC5805} from "@openzeppelin/contracts/interfaces/IERC5805.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {GovernorCountingFractional} from "flexible-voting/GovernorCountingFractional.sol";

import {GovernorSettableFixedQuorum} from "src/extensions/GovernorSettableFixedQuorum.sol";
import {GovernorMinimumWeightedVoteWindow} from "src/extensions/GovernorMinimumWeightedVoteWindow.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {IVoteExtender} from "src/interfaces/IVoteExtender.sol";

contract HubGovernor is
  GovernorCountingFractional,
  GovernorSettings,
  GovernorVotes,
  GovernorTimelockControl,
  GovernorSettableFixedQuorum,
  GovernorMinimumWeightedVoteWindow
{
  address public whitelistedProposer;
  HubVotePool public hubVotePool;
  IVoteExtender public governorProposalExtender;

  event WhitelistedProposerUpdated(address oldProposer, address newProposer);
  event GovernorProposalExtenderUpdated(address oldExtender, address newExtender);

  struct ConstructorParams {
    string name;
    ERC20Votes token;
    TimelockController timelock;
    uint48 initialVotingDelay;
    uint32 initialVotingPeriod;
    uint256 initialProposalThreshold;
    uint208 initialQuorum;
    address hubVotePool;
    address whitelistedVoteExtender;
    uint48 initialVoteWindow;
  }

  constructor(ConstructorParams memory _params)
    Governor(_params.name)
    GovernorSettings(_params.initialVotingDelay, _params.initialVotingPeriod, _params.initialProposalThreshold)
    GovernorVotes(_params.token)
    GovernorTimelockControl(_params.timelock)
    GovernorSettableFixedQuorum(_params.initialQuorum)
    GovernorMinimumWeightedVoteWindow(_params.initialVoteWindow)
  {
    _setHubVotePool(_params.hubVotePool);
    _setGovernorProposalExtender(_params.whitelistedVoteExtender);
  }

  function setHubVotePool(address _hubVotePool) external {
    _checkGovernance();
    _setHubVotePool(_hubVotePool);
  }

  function setGovernorProposalExtender(address _extender) public {
    _checkGovernance();
    _setGovernorProposalExtender(_extender);
  }

  function proposalDeadline(uint256 _proposalId) public view virtual override returns (uint256) {
    uint256 extendedDeadline;
    try governorProposalExtender.extendedDeadlines(_proposalId) {
      extendedDeadline = governorProposalExtender.extendedDeadlines(_proposalId);
    } catch {
      extendedDeadline = 0;
    }
    return Math.max(super.proposalDeadline(_proposalId), extendedDeadline);
  }

  function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
  ) public override returns (uint256) {
    address proposer = _msgSender();

    // check description restriction
    if (!_isValidDescriptionForProposer(proposer, description)) revert GovernorRestrictedProposer(proposer);

    // Check if whitelisted proposer
    if (proposer == whitelistedProposer) return _propose(targets, values, calldatas, description, proposer);

    // check proposal threshold
    uint256 proposerVotes = getVotes(proposer, clock() - 1);
    uint256 votesThreshold = proposalThreshold();
    if (proposerVotes < votesThreshold) {
      revert GovernorInsufficientProposerVotes(proposer, proposerVotes, votesThreshold);
    }
    return _propose(targets, values, calldatas, description, proposer);
  }

  function setWhitelistedProposer(address _proposer) external {
    _checkGovernance();
    _setWhitelistedProposer(_proposer);
  }

  function setVoteWeightWindow(uint48 _weightWindow) external {
    _checkGovernance();
    _setVoteWeightWindow(_weightWindow);
  }

  function token() public view virtual override(GovernorMinimumWeightedVoteWindow, GovernorVotes) returns (IERC5805) {
    return GovernorVotes.token();
  }

  function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
    internal
    virtual
    override(Governor, GovernorTimelockControl)
    returns (uint256)
  {
    return GovernorTimelockControl._cancel(targets, values, calldatas, descriptionHash);
  }

  function _setGovernorProposalExtender(address _extender) internal {
    emit GovernorProposalExtenderUpdated(address(governorProposalExtender), _extender);
    governorProposalExtender = IVoteExtender(_extender);
  }

  function _setHubVotePool(address _hubVotePool) internal {
    hubVotePool = HubVotePool(_hubVotePool);
  }

  function _setWhitelistedProposer(address _proposer) internal {
    emit WhitelistedProposerUpdated(whitelistedProposer, _proposer);
    whitelistedProposer = _proposer;
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
    if (address(hubVotePool) != account) {
      require(totalWeight > 0, "GovernorCountingFractional: no weight");
      if (voteWeightCast(proposalId, account) >= totalWeight) revert("GovernorCountingFractional: all weight cast");
    }

    uint128 safeTotalWeight = SafeCast.toUint128(totalWeight);

    if (voteData.length == 0) _countVoteNominal(proposalId, account, safeTotalWeight, support);
    else _countVoteFractional(proposalId, account, safeTotalWeight, voteData);
  }

  function _getVotes(address _account, uint256 _timepoint, bytes memory _params)
    internal
    view
    virtual
    override(Governor, GovernorVotes, GovernorMinimumWeightedVoteWindow)
    returns (uint256)
  {
    return GovernorMinimumWeightedVoteWindow._getVotes(_account, _timepoint, _params);
  }

  function _setVotingPeriod(uint32 newVotingPeriod) internal virtual override {
    if (
      address(governorProposalExtender) != address(0)
        && newVotingPeriod < governorProposalExtender.minimumExtensionTime()
    ) revert GovernorInvalidVotingPeriod(newVotingPeriod);
    super._setVotingPeriod(newVotingPeriod);
  }
}
