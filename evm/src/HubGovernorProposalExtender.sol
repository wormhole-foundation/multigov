// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubGovernor} from "src/HubGovernor.sol";

contract HubGovernorProposalExtender is Ownable {
  error AddressCannotExtendProposal();
  error AlreadyInitialized();
  error ProposalAlreadyExtended();
  error ProposalCannotBeExtended();
  error ProposalDoesNotExist();
  error InvalidExtensionTime();
  error InvalidUnsafeWindow();

  address public whitelistedVoteExtender;
  uint48 public proposalExtension;
  uint48 public minimumExtensionTime;
  HubGovernor public governor;
  bool public initialized;
  uint48 public minimumDecisionWindow;
  uint48 public safeWindow;

  mapping(uint256 proposalId => uint48 newVoteEnd) public extendedDeadlines;

  event ProposalExtensionTimeUpdated(uint48 oldExtension, uint48 newExtension);
  event SafeWindowUpdated(uint48 oldSafeWindow, uint48 newSafeWindow);
  event WhitelistedVoteExtenderUpdated(address oldExtender, address newExtender);

  constructor(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _owner,
    uint48 _minimumExtensionTime,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) Ownable(_owner) {
    minimumDecisionWindow = _minimumDecisionWindow;
    _setSafeWindow(_safeWindow);
    _setProposalExtension(_voteTimeExtension);
    _setWhitelistedVoteExtender(_whitelistedVoteExtender);
    minimumExtensionTime = _minimumExtensionTime;
  }

  function initialize(address payable _governor) external {
    if (initialized) revert AlreadyInitialized();
    initialized = true;
    governor = HubGovernor(_governor);
  }

  function extendProposal(uint256 _proposalId) external {
    uint256 exists = governor.proposalSnapshot(_proposalId);
    if (msg.sender != whitelistedVoteExtender) revert AddressCannotExtendProposal();
    if (exists == 0) revert ProposalDoesNotExist();
    if (extendedDeadlines[_proposalId] != 0) revert ProposalAlreadyExtended();
    IGovernor.ProposalState state = governor.state(_proposalId);
    if (state != IGovernor.ProposalState.Active && state != IGovernor.ProposalState.Pending) {
      revert ProposalCannotBeExtended();
    }
    if (_isVotingSafe(_proposalId)) revert ProposalCannotBeExtended();

    extendedDeadlines[_proposalId] = uint48(governor.proposalDeadline(_proposalId)) + proposalExtension;
  }

  function isVotingSafe(uint256 _proposalId) external view returns (bool) {
    return _isVotingSafe(_proposalId);
  }

  function setProposalExtension(uint48 _extensionTime) external {
    _checkOwner();
    if (_extensionTime > governor.votingPeriod() || _extensionTime < minimumExtensionTime) {
      revert InvalidExtensionTime();
    }
    _setProposalExtension(_extensionTime);
  }

  function setSafeWindow(uint48 _safeWindow) external {
    _checkOwner();
    if (_safeWindow > governor.votingPeriod()) revert InvalidUnsafeWindow();
    uint256 decisionPeriod = governor.votingPeriod() - _safeWindow;
    if (decisionPeriod < minimumDecisionWindow) revert InvalidUnsafeWindow();
    _setSafeWindow(_safeWindow);
  }

  function setWhitelistedVoteExtender(address _voteExtender) external {
    _checkOwner();
    _setWhitelistedVoteExtender(_voteExtender);
  }

  function _isVotingSafe(uint256 _proposalId) internal view returns (bool) {
    uint256 voteStart = governor.proposalSnapshot(_proposalId);
    return (voteStart + safeWindow) >= block.timestamp;
  }

  function _setProposalExtension(uint48 _extensionTime) internal {
    emit ProposalExtensionTimeUpdated(proposalExtension, _extensionTime);
    proposalExtension = _extensionTime;
  }

  function _setWhitelistedVoteExtender(address _voteExtender) internal {
    emit WhitelistedVoteExtenderUpdated(whitelistedVoteExtender, _voteExtender);
    whitelistedVoteExtender = _voteExtender;
  }

  function _setSafeWindow(uint48 _safeWindow) internal {
    emit SafeWindowUpdated(safeWindow, _safeWindow);
    safeWindow = _safeWindow;
  }
}
