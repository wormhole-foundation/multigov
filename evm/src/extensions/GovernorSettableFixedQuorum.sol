// SPDX-License-Identifier: Apache 2
pragma solidity 0.8.23;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

/// @title GovernorSettableFixedQuorum
/// @author [ScopeLift](https://scopelift.co)
/// @notice An abstract extension to the Governor which implements a fixed quorum which can be updated by governance.
abstract contract GovernorSettableFixedQuorum is Governor {
  using Checkpoints for Checkpoints.Trace208;

  /// @notice A history of quorum values for a given timestamp.
  Checkpoints.Trace208 internal _quorumCheckpoints;

  /// @notice Emitted when the quorum value has changed.
  event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

  /// @param _initialQuorum The number of total votes needed to pass a proposal.
  constructor(uint208 _initialQuorum) {
    _setQuorum(_initialQuorum);
  }

  /// @notice A function to get the quorum threshold for a given timestamp.
  /// @param _voteStart The timestamp of when voting starts for a given proposal.
  function quorum(uint256 _voteStart) public view override returns (uint256) {
    return _quorumCheckpoints.upperLookup(SafeCast.toUint48(_voteStart));
  }

  /// @notice A function to set quorum for the current block timestamp. Proposals created after this timestamp will be
  /// subject to the new quorum.
  /// @param _amount The new quorum threshold.
  function setQuorum(uint208 _amount) external {
    _checkGovernance();
    _setQuorum(_amount);
  }

  /// @notice A function to set quorum for the current block timestamp.
  /// @param _amount The quorum amount to checkpoint.
  function _setQuorum(uint208 _amount) internal {
    emit QuorumUpdated(quorum(block.timestamp), uint256(_amount));
    _quorumCheckpoints.push(SafeCast.toUint48(block.timestamp), _amount);
  }
}
