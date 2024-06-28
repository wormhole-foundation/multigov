// SPDX-License-Identifier: Apache 2
pragma solidity 0.8.23;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IERC5805} from "@openzeppelin/contracts/interfaces/IERC5805.sol";

import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title GovernorMinimumWeightedVoteWindow
/// @author [ScopeLift](https://scopelift.co)
/// @notice An abstract extension to the Governor which implements a minimum voting weight for a given window.
abstract contract GovernorMinimumWeightedVoteWindow {
  using Checkpoints for Checkpoints.Trace160;

  Checkpoints.Trace160 internal voteWeightWindowLengths;

  constructor(uint48 _initialVoteWeightWindowLength) {
    _setVoteWeightWindow(_initialVoteWeightWindowLength);
  }

  function getVoteWeightWindowLength(uint96 _timepoint) external view returns (uint48) {
    return SafeCast.toUint48(voteWeightWindowLengths.upperLookup(_timepoint));
  }

  function token() public view virtual returns (IERC5805);

  function _setVoteWeightWindow(uint48 _windowLength) internal {
    voteWeightWindowLengths.push(SafeCast.toUint96(block.timestamp), uint160(_windowLength));
  }

  function _getVotes(address _account, uint256 _timepoint, bytes memory) internal view virtual returns (uint256) {
    uint160 voteWeightWindowLength = voteWeightWindowLengths.upperLookup(SafeCast.toUint96(_timepoint));
    uint256 windowStart = _timepoint - SafeCast.toUint48(voteWeightWindowLength);
    ERC20Votes _token = ERC20Votes(address(token()));
    uint256 numCheckpoints = _token.numCheckpoints(_account);
    uint256 startPos = _upperLookupRecent(_account, uint32(windowStart), numCheckpoints);
    if (startPos == 0) return 0;

    uint208 votes = 0;
    for (uint256 pos = startPos - 1; pos < numCheckpoints; pos++) {
      Checkpoints.Checkpoint208 memory nextCheckpoint = _token.checkpoints(_account, uint32(pos));
      uint48 key = nextCheckpoint._key;
      if (key > _timepoint) break;
      uint208 amount = nextCheckpoint._value;
      if (amount < votes || (startPos - 1) == pos) votes = amount;
    }
    return votes;
  }

  /// @dev Returns the value in the last (most recent) checkpoint with key lower or equal than the search key, or zero
  /// if there is none.
  ///
  /// NOTE: This is a variant of {upperLookup} that is optimised to find "recent" checkpoint (checkpoints with high
  /// keys).
  function _upperLookupRecent(address _account, uint32 key, uint256 len) internal view returns (uint256) {
    uint256 low = 0;
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
