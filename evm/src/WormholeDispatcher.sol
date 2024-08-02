// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title WormholeDispatcher
/// @author [ScopeLift](https://scopelift.co)
/// @notice A helper contract, meant to be inherited, that dispatches cross chain messages via Wormhole Core.
contract WormholeDispatcher is Ownable {
  /// @notice The consistency level of a message when sending it to another chain.
  uint8 public consistencyLevel;

  /// @notice The Wormhole Core contract that publishes the cross chain message.
  IWormhole public wormholeCore;

  /// @notice Emitted when the consistency level is updated.
  event ConsistencyLevelUpdated(uint8 oldConsistencyLevel, uint8 newConsistencyLevel);

  /// @notice Emitted when the Wormhole Core contract is updated.
  event WormholeCoreUpdated(address oldCore, address newCore);

  /// @param _owner The owner of the contract.
  /// @param _core The Wormhole Core contract.
  /// @param _consistencyLevel The initial message consistency level.
  constructor(address _owner, address _core, uint8 _consistencyLevel) Ownable(_owner) {
    wormholeCore = IWormhole(_core);
    consistencyLevel = _consistencyLevel;
  }

  /// @notice Sets the consistency level for crosschain messages.
  /// @param _consistencyLevel The new consistency level.
  function setConsistencyLevel(uint8 _consistencyLevel) external {
    _checkOwner();
    _setConsistencyLevel(_consistencyLevel);
  }

  /// @notice Sets the Wormhole Core contract that will publish the cross chain message.
  /// @param _core The new Wormhole Core contract address.
  function setWormholeCore(address _core) external {
    _checkOwner();
    _setWormholeCore(_core);
  }

  function _setConsistencyLevel(uint8 _consistencyLevel) internal {
    emit ConsistencyLevelUpdated(consistencyLevel, _consistencyLevel);
    consistencyLevel = _consistencyLevel;
  }

  function _setWormholeCore(address _core) internal virtual {
    emit WormholeCoreUpdated(address(wormholeCore), _core);
    wormholeCore = IWormhole(_core);
  }

  function _publishMessage(bytes memory _payload) internal returns (uint256 sequence) {
    sequence = wormholeCore.publishMessage(0, _payload, consistencyLevel);
  }
}
