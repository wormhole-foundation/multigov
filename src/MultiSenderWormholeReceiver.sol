// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {WormholeReceiverBase} from "src/WormholeReceiverBase.sol";

// TODO Replay protection utilities can be moved here
abstract contract MultiSenderWormholeReceiver is WormholeReceiverBase {
  mapping(uint16 emitterChain => bytes32 emitterAddress) public spokeRegistry;

  error InvalidSourceChain();
  error InvalidSourceAddress();

  /// @dev Function was called with an unregistered sender address.
  error UnregisteredSender(uint16 chain, bytes32 wormholeAddress);

  event RegisteredSenderSet(address indexed owner, uint16 indexed sourceChain, bytes32 indexed sourceAddress);

  constructor(address _core, address _owner) WormholeReceiverBase(_core, _owner) {}

  /// @dev Set a registered sender for a given chain.
  /// @param sourceChain The Wormhole ID of the source chain to set the registered sender.
  /// @param sourceAddress The source address for receiving a wormhole message.
  function setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) public onlyOwner {
    _setRegisteredSender(sourceChain, sourceAddress);
  }

  function _setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) internal {
    if (sourceChain == 0) revert InvalidSourceChain();
    if (sourceAddress == 0) revert InvalidSourceAddress();
    spokeRegistry[sourceChain] = sourceAddress;
    emit RegisteredSenderSet(msg.sender, sourceChain, sourceAddress);
  }

  function _onlyValidSender(uint16 _senderChain, bytes32 _sender) internal view {
    bool validSender = spokeRegistry[_senderChain] == _sender;
    if (validSender == false) revert UnregisteredSender(_senderChain, _sender);
  }
}
