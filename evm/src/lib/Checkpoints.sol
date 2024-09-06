// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev This library was modified from Openzeppelin's Trace208 checkpoint library:
/// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/01ef448981be9d20ca85f2faf6ebdf591ce409f3/contracts/utils/structs/Checkpoints.sol#L22.
///
/// We removed the use of _unsafe access as the struct is now 2 slots.
library Checkpoints {
  /**
   * @dev A value was attempted to be inserted on a past checkpoint.
   */
  error CheckpointUnorderedInsertion();

  struct Trace256 {
    Checkpoint256[] _checkpoints;
  }

  struct Checkpoint256 {
    uint256 _key;
    uint256 _value;
  }

  /**
   * @dev Pushes a (`key`, `value`) pair into a Trace256 so that it is stored as the checkpoint.
   *
   * Returns previous value and new value.
   *
   * IMPORTANT: Never accept `key` as a user input, since an arbitrary `type(uint256).max` key set will disable the
   * library.
   */
  function push(Trace256 storage self, uint256 key, uint256 value) internal returns (uint256, uint256) {
    return _insert(self._checkpoints, key, value);
  }

  /**
   * @dev Returns the value in the last (most recent) checkpoint with key lower or equal than the search key, or zero
   * if there is none.
   */
  function upperLookup(Trace256 storage self, uint256 key) internal view returns (uint256) {
    uint256 len = self._checkpoints.length;
    uint256 pos = _upperBinaryLookup(self._checkpoints, key, 0, len);
    return pos == 0 ? 0 : self._checkpoints[pos - 1]._value;
  }

  /**
   * @dev Pushes a (`key`, `value`) pair into an ordered list of checkpoints, either by inserting a new checkpoint,
   * or by updating the last one.
   */
  function _insert(Checkpoint256[] storage self, uint256 key, uint256 value) private returns (uint256, uint256) {
    uint256 pos = self.length;

    if (pos > 0) {
      // Copying to memory is important here.
      Checkpoint256 memory last = self[pos - 1];

      // Checkpoint keys must be non-decreasing.
      if (last._key > key) revert CheckpointUnorderedInsertion();

      // Update or push new checkpoint
      if (last._key == key) self[pos - 1]._value = value;
      else self.push(Checkpoint256({_key: key, _value: value}));
      return (last._value, value);
    } else {
      self.push(Checkpoint256({_key: key, _value: value}));
      return (0, value);
    }
  }

  /**
   * @dev Return the index of the last (most recent) checkpoint with key lower or equal than the search key, or `high`
   * if there is none. `low` and `high` define a section where to do the search, with inclusive `low` and exclusive
   * `high`.
   *
   * WARNING: `high` should not be greater than the array's length.
   */
  function _upperBinaryLookup(Checkpoint256[] storage self, uint256 key, uint256 low, uint256 high)
    private
    view
    returns (uint256)
  {
    while (low < high) {
      uint256 mid = Math.average(low, high);
      if (self[mid]._key > key) high = mid;
      else low = mid + 1;
    }
    return high;
  }
}
