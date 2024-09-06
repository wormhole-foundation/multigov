// SPDX-License-Identifier: Apache 2
pragma solidity 0.8.23;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IERC5805} from "@openzeppelin/contracts/interfaces/IERC5805.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title GovernorMinimumWeightedVoteWindow
/// @author [ScopeLift](https://scopelift.co)
/// @notice An abstract extension to the Governor which will modify the voting weight so that the lowest checkpointed
/// weight over a given period is used. This calculation of voting weight can be useful in cross chain contexts as it
/// can help mitigate situations where weight is double counted.
abstract contract GovernorMinimumWeightedVoteWindow {
  using Checkpoints for Checkpoints.Trace160;

  /// @notice A history of the vote weight window. If a new weight window is set than a new checkpoint is added to this
  /// history.
  Checkpoints.Trace160 internal voteWeightWindowLengths;

  /// @notice Emitted When the vote weight window is updated.
  event VoteWeightWindowUpdated(uint48 oldVoteWeightWindow, uint48 newVoteWeightWindow);

  /// @param _initialVoteWeightWindowLength The length of time to set the vote weight window.
  constructor(uint48 _initialVoteWeightWindowLength) {
    _setVoteWeightWindow(_initialVoteWeightWindowLength);
  }

  /// @notice Get the vote weight window used for a given timepoint.
  /// @param _timepoint The timepoint to use when fetching the vote weight window.
  function getVoteWeightWindowLength(uint96 _timepoint) external view returns (uint48) {
    return SafeCast.toUint48(voteWeightWindowLengths.upperLookup(_timepoint));
  }

  /// @notice An interface method meant to return the token used by governance.
  function token() public view virtual returns (IERC5805);

  function _setVoteWeightWindow(uint48 _windowLength) internal {
    emit VoteWeightWindowUpdated(
      SafeCast.toUint48(voteWeightWindowLengths.upperLookup(SafeCast.toUint48(block.timestamp))), _windowLength
    );
    voteWeightWindowLengths.push(SafeCast.toUint96(block.timestamp), uint160(_windowLength));
  }

  /// @notice Gets the voting weight for a given account at a specific timepoint. The voting weight is determined by
  /// taking the minimum voting weight for an account over the vote weight window.
  /// @param _account The address used to get the voting weight.
  /// @param _timepoint The timestamp used as the end of the vote window.
  function _getVotes(address _account, uint256 _timepoint, bytes memory) internal view virtual returns (uint256) {
    uint160 _voteWeightWindowLength = voteWeightWindowLengths.upperLookup(SafeCast.toUint96(_timepoint));
    uint256 _windowStart = _timepoint - SafeCast.toUint48(_voteWeightWindowLength);
    ERC20Votes _token = ERC20Votes(address(token()));
    uint256 _numCheckpoints = _token.numCheckpoints(_account);
    uint256 _startPos = _upperLookupRecent(_account, uint32(_windowStart), _numCheckpoints);
    if (_startPos == 0) return 0;

    uint208 _votes = 0;
    for (uint256 pos = _startPos - 1; pos < _numCheckpoints; pos++) {
      Checkpoints.Checkpoint208 memory nextCheckpoint = _token.checkpoints(_account, uint32(pos));
      uint48 _key = nextCheckpoint._key;
      if (_key > _timepoint) break;
      uint208 _amount = nextCheckpoint._value;
      if (_amount < _votes || (_startPos - 1) == pos) _votes = _amount;
    }
    return _votes;
  }

  /// @dev Returns the value in the last (most recent) checkpoint with key lower or equal than the search key, or zero
  /// if there is none.
  ///
  /// NOTE: This is a variant of {upperLookup} that is optimised to find "recent" checkpoint (checkpoints with high
  /// keys).
  /// @dev This function was taken from
  /// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/dbb6104ce834628e473d2173bbc9d47f81a9eec3/contracts/utils/structs/Checkpoints.sol#L70
  /// The only change we made was we interpolated the upperBinaryLookup into upperLookupRecent and return the position.
  function _upperLookupRecent(address _account, uint32 _key, uint256 _len) internal view returns (uint256) {
    uint256 _low = 0;
    uint256 _high = _len;

    if (_len > 5) {
      uint256 _mid = _len - Math.sqrt(_len);
      if (_key < ERC20Votes(address(token())).checkpoints(_account, uint32(_mid))._key) _high = _mid;
      else _low = _mid + 1;
    }
    while (_low < _high) {
      uint256 _mid = Math.average(_low, _high);
      if (ERC20Votes(address(token())).checkpoints(_account, uint32(_mid))._key > _key) _high = _mid;
      else _low = _mid + 1;
    }
    return _high;
  }
}
