// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IVoteExtender} from "src/interfaces/IVoteExtender.sol";
import {HubGovernor} from "src/HubGovernor.sol";

/// @title HubProposalExtender
/// @notice A contract that enables the extension of proposals on the hub governor.
contract HubProposalExtender is Ownable, IVoteExtender {
  /// @notice The hub governor.
  HubGovernor public governor;

  /// @notice Whether the contract has been initialized.
  bool public initialized;

  /// @notice The amount of time for which target proposals will be extended.
  uint48 public extensionDuration;

  /// @notice The address of the trusted actor able to extend proposals.
  address public voteExtenderAdmin;

  /// @notice The deployer of the hub vote extender.
  address public immutable DEPLOYER;

  /// @notice The lower limit for extension duration.
  uint48 public immutable MINIMUM_EXTENSION_DURATION;

  /// @notice A mapping of proposal ids to their new vote end times.
  mapping(uint256 proposalId => uint48 newVoteEnd) public extendedDeadlines;

  /// @notice Emitted when the extension duration is updated.
  event ExtensionDurationUpdated(uint48 oldExtension, uint48 newExtension);

  /// @notice Emitted when the proposal deadline has been extended.
  event ProposalExtended(uint256 proposalId, uint48 newDeadline);

  /// @notice Emitted when the vote extender admin is updated.
  event VoteExtenderAdminUpdated(address oldAdmin, address newAdmin);

  /// @notice Thrown when the caller is not the vote extender admin.
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

  /// @notice Thrown when unauthorized address initializes this contract.
  error UnauthorizedInitialize(address);

  /// @notice Thrown when the deployer is set to the zero address.
  error DeployerIsZeroAddress();

  /// @param _voteExtenderAdmin Address of the trusted actor able to extend proposals.
  /// @param _extensionDuration Amount of time for which target proposals will be extended.
  /// @param _owner Owner of the contract.
  /// @param _deployer The deployer of the contract.
  /// @param _minimumExtensionDuration Lower limit for extension duration.
  constructor(
    address _voteExtenderAdmin,
    uint48 _extensionDuration,
    address _owner,
    address _deployer,
    uint48 _minimumExtensionDuration
  ) Ownable(_owner) {
    if (_deployer == address(0)) revert DeployerIsZeroAddress();
    _setExtensionDuration(_extensionDuration);
    _setVoteExtenderAdmin(_voteExtenderAdmin);
    MINIMUM_EXTENSION_DURATION = _minimumExtensionDuration;
    DEPLOYER = _deployer;
  }

  /// @notice Initializes the contract with the governor address.
  /// @param _governor Address of the hub governor.
  function initialize(address payable _governor) external {
    if (initialized) revert AlreadyInitialized();
    if (msg.sender != DEPLOYER) revert UnauthorizedInitialize(msg.sender);
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
    if (state != IGovernor.ProposalState.Active) revert ProposalCannotBeExtended();

    uint48 extendedDeadline = uint48(governor.proposalDeadline(_proposalId)) + extensionDuration;
    emit ProposalExtended(_proposalId, extendedDeadline);
    extendedDeadlines[_proposalId] = extendedDeadline;
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

  /// @notice Sets the address of the vote extender admin.
  /// @param _voteExtenderAdmin The new vote extender admin address.
  function setVoteExtenderAdmin(address _voteExtenderAdmin) external {
    _checkOwner();
    _setVoteExtenderAdmin(_voteExtenderAdmin);
  }

  function _setExtensionDuration(uint48 _extensionTime) internal {
    emit ExtensionDurationUpdated(extensionDuration, _extensionTime);
    extensionDuration = _extensionTime;
  }

  function _setVoteExtenderAdmin(address _voteExtenderAdmin) internal {
    emit VoteExtenderAdminUpdated(voteExtenderAdmin, _voteExtenderAdmin);
    voteExtenderAdmin = _voteExtenderAdmin;
  }
}
