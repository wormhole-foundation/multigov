// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {WormholeReceiverBase} from "src/WormholeReceiverBase.sol";

// TODO Replay protection utilities can be moved here
abstract contract SingleSenderWormholeReceiver is WormholeReceiverBase {
  uint16 public registeredSenderChain;
  bytes32 public registeredSenderAddress;

  error InvalidSourceChain();
  error InvalidSourceAddress();
  /// @dev Function was called with an unregistered sender address.
  error UnregisteredSender(uint16 chain, bytes32 wormholeAddress);

  /// @dev A mapping of Wormhole chain ID to a mapping of wormhole serialized sender address to
  /// existence boolean.
  //mapping(uint16 => mapping(bytes32 => bool)) public registeredSenders;

  event RegisteredSenderSet(address indexed owner, uint16 indexed sourceChain, bytes32 indexed sourceAddress);

  constructor(address _core, address _owner, uint16 _chainId, bytes32 _senderAddress)
    WormholeReceiverBase(_core, _owner)
  {
    _setRegisteredSender(_chainId, _senderAddress);
  }

  /// @dev Set a registered sender for a given chain.
  /// @param sourceChain The Wormhole ID of the source chain to set the registered sender.
  /// @param sourceAddress The source address for receiving a wormhole message.

  function setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) public onlyOwner {
    _setRegisteredSender(sourceChain, sourceAddress);
  }

  function _setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) internal {
    if (sourceChain == 0) revert InvalidSourceChain();
    if (sourceAddress == 0) revert InvalidSourceAddress();
    registeredSenderChain = sourceChain;
    registeredSenderAddress = sourceAddress;
    emit RegisteredSenderSet(msg.sender, sourceChain, sourceAddress); // TODO do we need the old chain and address
  }

  function _onlyValidSender(uint16 _senderChain, bytes32 _sender) internal view {
    bool validSender = _senderChain == registeredSenderChain && _sender == registeredSenderAddress;
    if (validSender == false) revert UnregisteredSender(_senderChain, _sender);
  }
}
