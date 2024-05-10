// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingFractional} from "flexible-voting/GovernorCountingFractional.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {GovernorSettableFixedQuorum} from "src/extensions/GovernorSettableFixedQuorum.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

contract HubGovernor is
  GovernorCountingFractional,
  GovernorSettings,
  GovernorVotes,
  GovernorTimelockControl,
  GovernorSettableFixedQuorum
{
  mapping(address votingAddress => bool enabled) public trustedVotingAddresses;

  constructor(
    string memory _name,
    IVotes _token, // May make sense to change to erc20 votes
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
    GovernorSettableFixedQuorum(_initialQuorum)
  {
    _enableTrustedVotingAddress(_trustedVotingAddress);
  }

  function enableTrustedVotingAddress(address _trustedAddress) external {
    _checkGovernance();
    _enableTrustedVotingAddress(_trustedAddress);
  }

  function disableTrustedVotingAddress(address _trustedAddress) external {
    _checkGovernance();
    _disableTrustedVotingAddress(_trustedAddress);
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
    if (!trustedVotingAddresses[account]) {
      require(totalWeight > 0, "GovernorCountingFractional: no weight");
      if (voteWeightCast(proposalId, account) >= totalWeight) revert("GovernorCountingFractional: all weight cast");
    }

    uint128 safeTotalWeight = SafeCast.toUint128(totalWeight);

    if (voteData.length == 0) _countVoteNominal(proposalId, account, safeTotalWeight, support);
    else _countVoteFractional(proposalId, account, safeTotalWeight, voteData);
  }

  // Override _getVotes
  // 1. Get the start position using a similar binary search
  // 2. Then iterate through until we are past the end time and take the min

  /// Reimplement binary search and also fetch position, do the same for the endpoint then iterate through each position
  /// Lets do one lookup, then we get the first position then we interate until we hit the second position.
  function getMinVotesInWindow(uint256 _windowStart, address _account) public returns (uint256) {
    uint256 windowEnd = _windowStart + 9;
    uint256 numCheckpoints = ERC20Votes(address(token())).numCheckpoints(_account);
    uint256 startPos = _upperBinaryLookupPosition(_account, uint32(_windowStart), 0, numCheckpoints);
    if (startPos == 0) return 0;
    uint208 votes = type(uint208).max;
    for (uint256 i = startPos - 1; i < numCheckpoints; i++) {
      Checkpoints.Checkpoint208 memory nextCheckpoint = ERC20Votes(address(token())).checkpoints(_account, uint32(i));
      uint48 key = nextCheckpoint._key;
      if (key > windowEnd) break;
      uint208 amount = nextCheckpoint._value;
      if (amount < votes) votes = amount;
    }
    return votes;
  }

  function _upperBinaryLookupPosition(address _account, uint32 key, uint256 low, uint256 len)
    internal
    view
    returns (uint256)
  {
    uint256 high = len;

    if (len > 5) {
      uint256 mid = len - Math.sqrt(len);
      if (key < ERC20Votes(address(token())).checkpoints(_account, uint32(mid))._key) high = mid;
      else low = mid + 1;
    }
    while (low < high) {
      uint256 mid = Math.average(low, high);
      if (ERC20Votes(address(token())).checkpoints(_account, uint32(mid))._key > key) high = mid;
      else low = mid + 1;
    }
    return high;
  }
}
