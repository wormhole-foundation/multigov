// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract SpokeLieutenant {
  // wormhole representation of address
  bytes32 public immutable HUB_TIMELOCK;
  uint16 public immutable HUB_CHAIN_ID;
  IWormhole public immutable WORMHOLE_CORE;

  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  constructor(bytes32 _hubTimelock, uint16 _hubChainId, IWormhole _wormholeCore) {
    HUB_TIMELOCK = _hubTimelock;
    HUB_CHAIN_ID = _hubChainId;
    WORMHOLE_CORE = _wormholeCore;
  }

  function receiveMessage(bytes memory _encodedMessage) public {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);

    if (!valid) revert InvalidWormholeMessage(reason);
    // TODO: TIMELOCK or GOVERNOR?
    if (wormholeMessage.emitterAddress != HUB_TIMELOCK || wormholeMessage.emitterChainId != HUB_CHAIN_ID) {
      revert UnknownMessageEmitter();
    }

    (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
      abi.decode(wormholeMessage.payload, (address[], uint256[], bytes[]));

    // TODO: Need proposalId or descriptionHash?
    _executeOperations(0, targets, values, calldatas, bytes32(0));
  }

  function _executeOperations(
    uint256, /* proposalId */
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 /*descriptionHash*/
  ) internal {
    for (uint256 i = 0; i < targets.length; ++i) {
      // TODO: delegateCall?
      (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
      Address.verifyCallResult(success, returndata);
    }
  }
}
