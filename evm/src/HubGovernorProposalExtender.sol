// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

import {HubVotePool} from "src/HubVotePool.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract HubGovernorProposalExtender is Ownable {
  error AddressCannotExtendProposal();
  error AlreadyInitialized();
  error ProposalAlreadyExtended();
  error ProposalCannotBeExtended();
  error ProposalDoesNotExist();
  error InvalidExtensionTime();

  address public whitelistedVoteExtender;
  uint48 public proposalExtension;
  uint48 public minimumExtensionTime;
  HubGovernor public governor;
  bool public initialized;

  mapping(uint256 proposalId => uint48 newVoteEnd) public extendedDeadlines;

  event WhitelistedVoteExtenderUpdated(address oldExtender, address newExtended);
  event ProposalExtensionTimeUpdated(uint48 oldExtension, uint48 newExtension);

  constructor(address _whitelistedVoteExtender, uint48 _voteTimeExtension, address _owner, uint48 _minimumExtensionTime)
    Ownable(_owner)
  {
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
    if (
      governor.state(_proposalId) != IGovernor.ProposalState.Active
        && governor.state(_proposalId) != IGovernor.ProposalState.Pending
    ) revert ProposalCannotBeExtended();
    if (HubVotePool(address(governor.hubVotePool())).isVotingSafe(_proposalId)) revert ProposalCannotBeExtended();

    extendedDeadlines[_proposalId] = uint48(governor.proposalDeadline(_proposalId)) + proposalExtension;
  }

  function setProposalExtension(uint48 _extensionTime) external {
    _checkOwner();
    if (_extensionTime >= governor.votingPeriod() || _extensionTime < minimumExtensionTime) {
      revert InvalidExtensionTime();
    }
    _setProposalExtension(_extensionTime);
  }

  function setWhitelistedVoteExtender(address _voteExtender) external {
    _checkOwner();
    _setWhitelistedVoteExtender(_voteExtender);
  }

  function _setInitialized() internal {
    initialized = true;
  }

  function _setProposalExtension(uint48 _extensionTime) internal {
    emit ProposalExtensionTimeUpdated(proposalExtension, _extensionTime);
    proposalExtension = _extensionTime;
  }

  function _setWhitelistedVoteExtender(address _voteExtender) internal {
    emit WhitelistedVoteExtenderUpdated(whitelistedVoteExtender, _voteExtender);
    whitelistedVoteExtender = _voteExtender;
  }
}
