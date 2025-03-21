// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {IERC5805} from "@openzeppelin/contracts/interfaces/IERC5805.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {GovernorCountingFractional} from "src/lib/GovernorCountingFractional.sol";
import {GovernorSettableFixedQuorum} from "src/extensions/GovernorSettableFixedQuorum.sol";
import {GovernorMinimumWeightedVoteWindow} from "src/extensions/GovernorMinimumWeightedVoteWindow.sol";
import {IVoteExtender} from "src/interfaces/IVoteExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";

/// @title HubGovernor
/// @author [ScopeLift](https://scopelift.co)
/// @notice A governance contract that natively supports multi-chain governance.
contract HubGovernor is
  GovernorCountingFractional,
  GovernorSettings,
  GovernorVotes,
  GovernorTimelockControl,
  GovernorSettableFixedQuorum,
  GovernorMinimumWeightedVoteWindow
{
  using Checkpoints for Checkpoints.Trace160;

  /// @notice An address that can create a proposal without having any voting weight to support an address creating a
  /// proposal when their voting weight is distributed on multiple chains. Typically, this will be set to a deployed
  /// `HubEvmSpokeAggregateProposer`.
  address public whitelistedProposer;

  /// @notice A contract that will be able to extend the proposal deadline. The `HubProposalExtender` is an
  /// implementation that is meant to be set as the proposal extender.
  IVoteExtender public immutable HUB_PROPOSAL_EXTENDER;

  /// @notice This is a contract that will receive votes from the spokes and cast votes to the `HubGovernor` without
  /// having any voting weight.
  Checkpoints.Trace160 internal hubVotePools;

  /// @notice Emitted when the `hubVotePool` is changed.
  event HubVotePoolUpdated(address oldHubVotePool, address newHubVotePool);

  /// @notice Emitted when a whitelisted proposer is changed.
  event WhitelistedProposerUpdated(address oldProposer, address newProposer);

  /// @notice Thrown if `HUB_PROPOSAL_EXTENDER` is attempted to be set to an EOA.
  error InvalidProposalExtender();

  /// @param name The name used as the EIP712 signing domain.
  /// @param token The token used for voting on proposals.
  /// @param timelock The timelock used for managing proposals.
  /// @param initialVotingDelay The delay before voting on a proposal begins.
  /// @param initialProposalThreshold The number of tokens needed to create a proposal.
  /// @param initialQuorum The number of total votes needed to pass a proposal.
  /// @param hubVotePool A contract to receive votes from spokes and submit them to the `HubGovernor`. This address can
  /// submit a vote without having any voting weight.
  /// @param governorProposalExtender A contract that can extend the voting period.
  /// @param initialVoteWeightWindow A window where the minimum checkpointed voting weight is taken for a given address.
  /// The window ends at the vote start for a proposal and begins at the vote start minus the vote weight window.
  struct ConstructorParams {
    string name;
    ERC20Votes token;
    TimelockController timelock;
    uint48 initialVotingDelay;
    uint32 initialVotingPeriod;
    uint256 initialProposalThreshold;
    uint208 initialQuorum;
    address hubVotePool;
    address wormholeCore;
    address governorProposalExtender;
    uint48 initialVoteWeightWindow;
  }

  constructor(ConstructorParams memory _params)
    Governor(_params.name)
    GovernorSettings(_params.initialVotingDelay, _params.initialVotingPeriod, _params.initialProposalThreshold)
    GovernorVotes(_params.token)
    GovernorTimelockControl(_params.timelock)
    GovernorSettableFixedQuorum(_params.initialQuorum)
    GovernorMinimumWeightedVoteWindow(_params.initialVoteWeightWindow)
  {
    _setHubVotePool(address(_params.hubVotePool));
    if (
      _params.governorProposalExtender.code.length == 0
        || Ownable(_params.governorProposalExtender).owner() != address(_params.timelock)
    ) revert InvalidProposalExtender();
    HUB_PROPOSAL_EXTENDER = IVoteExtender(_params.governorProposalExtender);
  }

  function hubVotePool(uint96 _timepoint) public view virtual returns (HubVotePool) {
    return HubVotePool(address(hubVotePools.upperLookup(_timepoint)));
  }

  /// @notice The timepoint at which a proposal vote ends. This time can be extended by the
  /// `HUB_PROPOSAL_EXTENDER`.
  /// @param _proposalId The id of the proposal for which to get the vote end.
  /// @return The timestamp of the proposal deadline.
  function proposalDeadline(uint256 _proposalId) public view virtual override returns (uint256) {
    return Math.max(super.proposalDeadline(_proposalId), HUB_PROPOSAL_EXTENDER.extendedDeadlines(_proposalId));
  }

  /// @inheritdoc GovernorTimelockControl
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function proposalNeedsQueuing(uint256 _proposalId)
    public
    view
    virtual
    override(Governor, GovernorTimelockControl)
    returns (bool)
  {
    return GovernorTimelockControl.proposalNeedsQueuing(_proposalId);
  }

  /// @inheritdoc GovernorSettings
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function proposalThreshold() public view virtual override(Governor, GovernorSettings) returns (uint256) {
    return GovernorSettings.proposalThreshold();
  }

  /// @notice This function creates a new proposal if the proposer is either the `whitelistedProposer` or has enough
  /// voting weight to exceed the proposal threshold.
  /// @dev This function differs from the overridden implemenation by supporting a `whitelistedProposer`. A
  /// `whitelisted` propser is able to create proposal without having any voting weight.
  /// @param _targets A list of contracts to call when a proposal is executed.
  /// @param _values A list of values to send when calling each target.
  /// @param _calldatas A list of calldatas to use when calling the targets.
  /// @param _description A description of the proposal.
  function propose(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description
  ) public override returns (uint256) {
    address _proposer = _msgSender();

    // check description restriction
    if (!_isValidDescriptionForProposer(_proposer, _description)) revert GovernorRestrictedProposer(_proposer);

    // check if whitelisted proposer
    if (_proposer == whitelistedProposer) return _propose(_targets, _values, _calldatas, _description, _proposer);

    // check proposal threshold
    uint256 _proposerVotes = getVotes(_proposer, clock() - 1);
    uint256 _votesThreshold = proposalThreshold();
    if (_proposerVotes < _votesThreshold) {
      revert GovernorInsufficientProposerVotes(_proposer, _proposerVotes, _votesThreshold);
    }
    return _propose(_targets, _values, _calldatas, _description, _proposer);
  }

  /// @notice A function that will set the hub vote pool on the governor and can only be called through governance.
  /// @param _hubVotePool The new hub vote pool to set on the `HubGovernor`.
  function setHubVotePool(address _hubVotePool) external {
    _checkGovernance();
    _setHubVotePool(_hubVotePool);
  }

  /// @notice This allows governance to update the voting period as long as it is greater than the minimum extension
  /// time on the `HUB_PROPOSAL_EXTENDER`.
  /// @param _newVotingPeriod The new vote period length.
  function setVotingPeriod(uint32 _newVotingPeriod) public virtual override {
    _checkGovernance();
    if (_newVotingPeriod < HUB_PROPOSAL_EXTENDER.MINIMUM_EXTENSION_DURATION()) {
      revert GovernorInvalidVotingPeriod(_newVotingPeriod);
    }
    return _setVotingPeriod(_newVotingPeriod);
  }

  /// @notice This can only be called by governance and updates the whitelisted proposer to a new address.
  /// @param _proposer The new whitelisted proposer address.
  function setWhitelistedProposer(address _proposer) external {
    _checkGovernance();
    _setWhitelistedProposer(_proposer);
  }

  /// @notice This allows governance to set a new vote weight window.
  /// @param _weightWindow The new vote weight window.
  function setVoteWeightWindow(uint48 _weightWindow) external {
    _checkGovernance();
    _setVoteWeightWindow(_weightWindow);
  }

  /// @inheritdoc GovernorTimelockControl
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function state(uint256 _proposalId)
    public
    view
    virtual
    override(Governor, GovernorTimelockControl)
    returns (ProposalState)
  {
    return GovernorTimelockControl.state(_proposalId);
  }

  /// @inheritdoc GovernorVotes
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function token() public view virtual override(GovernorMinimumWeightedVoteWindow, GovernorVotes) returns (IERC5805) {
    return GovernorVotes.token();
  }

  /// @inheritdoc GovernorTimelockControl
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function _cancel(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    bytes32 _descriptionHash
  ) internal virtual override(Governor, GovernorTimelockControl) returns (uint256) {
    return GovernorTimelockControl._cancel(_targets, _values, _calldatas, _descriptionHash);
  }

  /// @notice GovernorCountingFractional
  /// @dev If the account is the `hubVotePool` then we allow a vote to be recorded without checking its weight cast. It
  /// is the responsibility of the `hubVotePool` to prevent voting inconsistent with the vote weight held on spoke
  /// chains.
  function _countVote(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    uint256 _totalWeight,
    bytes memory _voteData
  ) internal virtual override(Governor, GovernorCountingFractional) {
    uint256 _voteStart = proposalSnapshot(_proposalId);
    // if the account is the hub vote pool then we allow the vote to be counted without checking the weight
    if (_account == address(hubVotePool(SafeCast.toUint96(_voteStart)))) _totalWeight = type(uint128).max;
    GovernorCountingFractional._countVote(_proposalId, _account, _support, _totalWeight, _voteData);
  }

  /// @inheritdoc GovernorTimelockControl
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function _executeOperations(
    uint256 _proposalId,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    bytes32 _descriptionHash
  ) internal virtual override(Governor, GovernorTimelockControl) {
    GovernorTimelockControl._executeOperations(_proposalId, _targets, _values, _calldatas, _descriptionHash);
  }

  /// @inheritdoc GovernorTimelockControl
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function _executor() internal view virtual override(Governor, GovernorTimelockControl) returns (address) {
    return GovernorTimelockControl._executor();
  }

  /// @inheritdoc GovernorMinimumWeightedVoteWindow
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function _getVotes(address _account, uint256 _timepoint, bytes memory _params)
    internal
    view
    virtual
    override(Governor, GovernorVotes, GovernorMinimumWeightedVoteWindow)
    returns (uint256)
  {
    return GovernorMinimumWeightedVoteWindow._getVotes(_account, _timepoint, _params);
  }

  /// @inheritdoc GovernorTimelockControl
  /// @dev We override this function to resolve ambiguity between inherited contracts.
  function _queueOperations(
    uint256 _proposalId,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    bytes32 _description
  ) internal virtual override(Governor, GovernorTimelockControl) returns (uint48) {
    return GovernorTimelockControl._queueOperations(_proposalId, _targets, _values, _calldatas, _description);
  }

  /// @notice An internal function to update the hub vote pool to a new address.
  /// @param _hubVotePool The address of the new hub vote pool.
  function _setHubVotePool(address _hubVotePool) internal {
    emit HubVotePoolUpdated(address(hubVotePools.upperLookup(SafeCast.toUint96(block.timestamp))), _hubVotePool);
    hubVotePools.push(SafeCast.toUint96(block.timestamp), uint160(_hubVotePool));
  }

  function _setWhitelistedProposer(address _proposer) internal {
    emit WhitelistedProposerUpdated(whitelistedProposer, _proposer);
    whitelistedProposer = _proposer;
  }
}
