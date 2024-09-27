// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract HubSpokeRegistry {
  /// @notice A mapping of registered spoke aggregators per chain. These chains and addresses determine the chains and
  /// addresses that can be queried in order to aggregate voting weight.
  mapping(uint16 wormholeChainId => address spokeVoteAggregator) public registeredSpokes;

  /// @notice Emitted when a spoke is registered.
  event SpokeRegistered(uint16 indexed chainId, address oldSpokeAddress, address newSpokeAddress);


  function registerSpoke(uint16 _chainId, address _spokeVoteAggregator) external {
    emit SpokeRegistered(_chainId, registeredSpokes[_chainId], _spokeVoteAggregator);
    registeredSpokes[_chainId] = _spokeVoteAggregator;
  }

}
