// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubGovernor} from "src/HubGovernor.sol";

/// @title HubProposalExtender
/// @notice A contract that enables the extension of proposals on the hub governor.
contract HubProposalExtender is Ownable {
  /// @notice The hub governor.
  HubGovernor public governor;

  /// @notice Whether the contract has been initialized.
  bool public initialized;

  /// @notice The amount of time for which target proposals will be extended.
  uint48 public extensionDuration;

  /// @notice The period of time after a proposal's vote start during which spoke votes are expected to be included.
  uint48 public safeWindow;

  /// @notice The address of the trusted actor able to extend proposals.
  address public voteExtenderAdmin;

  /// @notice The lower limit for extension duration.
  uint48 public immutable MINIMUM_EXTENSION_DURATION;

  /// @notice The lower limit for unsafe window.
  uint48 public immutable MINIMUM_DECISION_WINDOW;

  /// @notice A mapping of proposal ids to their new vote end times.
  mapping(uint256 proposalId => uint48 newVoteEnd) public extendedDeadlines;

  /// @notice Emitted when the extension duration is updated.
  event ExtensionDurationUpdated(uint48 oldExtension, uint48 newExtension);

  /// @notice Emitted when the safe window is updated.
  event SafeWindowUpdated(uint48 oldSafeWindow, uint48 newSafeWindow);

  /// @notice Emitted when the whitelisted vote extender is updated.
  event WhitelistedVoteExtenderUpdated(address oldExtender, address newExtender);

  /// @notice Thrown when the caller is not the owner.
  error AddressCannotExtendProposal();

  /// @notice Thrown when the contract has already been initialized.
  error AlreadyInitialized();

  /// @notice Thrown when the proposal has already been extended.
  error ProposalAlreadyExtended();

  /// @notice Thrown when the proposal cannot be extended.
  error ProposalCannotBeExtended();

  /// @notice Thrown when the proposal does not exist.
  error ProposalDoesNotExist();

  /// @notice Thrown when the extension duration is invalid.
  error InvalidExtensionDuration();

  /// @notice Thrown when the unsafe window is invalid.
  error InvalidUnsafeWindow();

  /// @param _whitelistedVoteExtender Address of the trusted actor able to extend proposals.
  /// @param _extensionDuration Amount of time for which target proposals will be extended.
  /// @param _owner Owner of the contract.
  /// @param _minimumExtensionDuration Lower limit for extension duratio`.
  /// @param _safeWindow The period of time after a proposal's vote start, during which spoke votes are expected to be
  /// reliably counted. It's the inverse of "unsafe window," which is the period of time between the safe window and
  /// vote end. Proposals can be extended during the unsafe window.
  /// @param _minimumDecisionWindow Lower limit for unsafe window.
  constructor(
    address _whitelistedVoteExtender,
    uint48 _extensionDuration,
    address _owner,
    uint48 _minimumExtensionDuration,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) Ownable(_owner) {
    _setSafeWindow(_safeWindow);
    _setExtensionDuration(_extensionDuration);
    _setWhitelistedVoteExtender(_whitelistedVoteExtender);
    MINIMUM_EXTENSION_DURATION = _minimumExtensionDuration;
    MINIMUM_DECISION_WINDOW = _minimumDecisionWindow;
  }

  /// @notice Initializes the contract with the governor address.
  /// @param _governor Address of the hub governor.
  function initialize(address payable _governor) external {
    if (initialized) revert AlreadyInitialized();
    initialized = true;
    governor = HubGovernor(_governor);
  }

  /// @notice Extends the deadline of a proposal.
  /// @param _proposalId The id of the proposal to extend.
  function extendProposal(uint256 _proposalId) external {
    uint256 exists = governor.proposalSnapshot(_proposalId);
    if (msg.sender != voteExtenderAdmin) revert AddressCannotExtendProposal();
    if (exists == 0) revert ProposalDoesNotExist();
    if (extendedDeadlines[_proposalId] != 0) revert ProposalAlreadyExtended();
    IGovernor.ProposalState state = governor.state(_proposalId);
    if (state != IGovernor.ProposalState.Active && state != IGovernor.ProposalState.Pending) {
      revert ProposalCannotBeExtended();
    }
    if (_isVotingSafe(_proposalId)) revert ProposalCannotBeExtended();

    extendedDeadlines[_proposalId] = uint48(governor.proposalDeadline(_proposalId)) + extensionDuration;
  }

  /// @notice Checks if voting on a proposal on a spoke can be considered "safe," meaning that the vote is expected to
  /// be relayed before the proposal ends on the hub.
  /// @param _proposalId The id of the proposal to check.
  function isVotingSafe(uint256 _proposalId) external view returns (bool) {
    return _isVotingSafe(_proposalId);
  }

  /// @notice Sets the proposal extension duration.
  /// @param _extensionDuration The new proposal extension duration.
  function setExtensionDuration(uint48 _extensionDuration) external {
    _checkOwner();
    if (_extensionDuration > governor.votingPeriod() || _extensionDuration < MINIMUM_EXTENSION_DURATION) {
      revert InvalidExtensionDuration();
    }
    _setExtensionDuration(_extensionDuration);
  }

  /// @notice Sets the safe window duration.
  /// @param _safeWindow The new safe window duration.
  function setSafeWindow(uint48 _safeWindow) external {
    _checkOwner();
    if (_safeWindow > governor.votingPeriod()) revert InvalidUnsafeWindow();
    uint256 decisionPeriod = governor.votingPeriod() - _safeWindow;
    if (decisionPeriod < MINIMUM_DECISION_WINDOW) revert InvalidUnsafeWindow();
    _setSafeWindow(_safeWindow);
  }

  /// @notice Sets the address of the whitelisted vote extender.
  /// @param _voteExtender The new whitelisted vote extender address.
  function setWhitelistedVoteExtender(address _voteExtender) external {
    _checkOwner();
    _setWhitelistedVoteExtender(_voteExtender);
  }

  function _isVotingSafe(uint256 _proposalId) internal view returns (bool) {
    uint256 voteStart = governor.proposalSnapshot(_proposalId);
    return (voteStart + safeWindow) >= block.timestamp;
  }

  function _setExtensionDuration(uint48 _extensionTime) internal {
    emit ExtensionDurationUpdated(extensionDuration, _extensionTime);
    extensionDuration = _extensionTime;
  }

  function _setWhitelistedVoteExtender(address _voteExtender) internal {
    emit WhitelistedVoteExtenderUpdated(voteExtenderAdmin, _voteExtender);
    voteExtenderAdmin = _voteExtender;
  }

  function _setSafeWindow(uint48 _safeWindow) internal {
    emit SafeWindowUpdated(safeWindow, _safeWindow);
    safeWindow = _safeWindow;
  }
}
