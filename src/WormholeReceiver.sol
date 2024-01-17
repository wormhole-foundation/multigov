// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

// TODO Replay protection utilities can be moved here
abstract contract WormholeReceiver is Ownable {
  IWormhole public immutable WORMHOLE_CORE;
  uint16 public registeredSenderChain;
  bytes32 public registeredSenderAddress;

  error InvalidWormholeMessage(string);

  /// @dev Function was called with an unregistered sender address.
  error UnregisteredSender(uint16 chain, bytes32 wormholeAddress);

  /// @dev A mapping of Wormhole chain ID to a mapping of wormhole serialized sender address to
  /// existence boolean.
  //mapping(uint16 => mapping(bytes32 => bool)) public registeredSenders;

  event RegisteredSenderSet(address indexed owner, uint16 indexed sourceChain, bytes32 indexed sourceAddress);

  constructor(address _core, address _owner) Ownable(_owner) {
    WORMHOLE_CORE = IWormhole(_core);
  }

  /// @dev This method should receive an encoded message from a relayer, validate it and take any necessary action on the 
  ///  target chain (e.g. mint a token or store some source chain data).
  function receiveMessage(bytes memory _encodedMessage) public virtual;

  function _validMessage(bytes memory _encodedMessage) internal view returns (IWormhole.VM memory, bool, string memory) {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);
    if (!valid) revert InvalidWormholeMessage(reason);
    return (wormholeMessage, valid, reason);
  }

  /// @dev Set a registered sender for a given chain.
  /// @param sourceChain The Wormhole ID of the source chain to set the registered sender.
  /// @param sourceAddress The source address for receiving a wormhole message.
  function setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) public onlyOwner {
		  _setRegisteredSender(sourceChain, sourceAddress);
  }

  function _setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) internal {
   registeredSenderChain = sourceChain;
   registeredSenderAddress = sourceAddress;
    emit RegisteredSenderSet(msg.sender, sourceChain, sourceAddress); // TODO do we need the old chain and address
  }

  function _onlyValidSender(uint16 _senderChain, bytes32 _sender) internal view {
    bool validSender = _senderChain == registeredSenderChain && _sender == registeredSenderAddress;
    if (validSender == false) revert UnregisteredSender(_senderChain, _sender);
  }
}
