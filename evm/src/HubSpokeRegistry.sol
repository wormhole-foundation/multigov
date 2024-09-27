// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Checkpoints} from "src/lib/Checkpoints.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract HubSpokeRegistry {
  using Checkpoints for Checkpoints.Trace256;

  /// @notice A mapping of registered spoke aggregators per chain. These chains and addresses determine the chains and
  /// addresses that can be queried in order to aggregate voting weight.
  mapping(uint16 wormholeChainId => Checkpoints.Trace256 spokeVoteAggregator) internal emitterRegistry;

  /// @notice Emitted when a spoke is registered.
  event SpokeRegistered(uint16 indexed chainId, bytes32 oldSpokeAddress, bytes32 newSpokeAddress);


  function registerSpoke(uint16 _chainId, bytes32 _spokeVoteAggregator) external {
    Checkpoints.Trace256 storage registeredAddressCheckpoint = emitterRegistry[_chainId];
    emit SpokeRegistered(
      _chainId, bytes32(registeredAddressCheckpoint.upperLookup(block.timestamp)), _spokeVoteAggregator
	);
    registeredAddressCheckpoint.push(block.timestamp, uint256(_spokeVoteAggregator));
  }

  function getSpoke(uint16 _emitterChainId, uint256 _timepoint) external view returns (bytes32) {
    return bytes32(emitterRegistry[_emitterChainId].upperLookup(_timepoint));
  }



}
