// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

abstract contract WormholeReceiverBase is Ownable {
  IWormhole public immutable WORMHOLE_CORE;

  error InvalidWormholeMessage(string);

  constructor(address _core, address _owner) Ownable(_owner) {
    WORMHOLE_CORE = IWormhole(_core);
  }

  /// @dev This method should receive an encoded message from a relayer, validate it and take any necessary action on
  /// the
  ///  target chain (e.g. mint a token or store some source chain data).
  function receiveMessage(bytes memory _encodedMessage) public virtual;

  function _validateMessage(bytes memory _encodedMessage)
    internal
    view
    returns (IWormhole.VM memory, bool, string memory)
  {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);
    if (!valid) revert InvalidWormholeMessage(reason);
    return (wormholeMessage, valid, reason);
  }
}
