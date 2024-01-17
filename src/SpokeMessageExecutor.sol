// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";

contract SpokeMessageExecutor {
  // wormhole representation of address
  bytes32 public immutable HUB_DISPATCHER;
  uint16 public immutable HUB_CHAIN_ID;
  IWormhole public immutable WORMHOLE_CORE;
  uint256 public immutable SPOKE_INDEX;
  SpokeAirlock public airlock;

  error InvalidCaller();
  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  // EIP 5164
  event MessageIdExecuted(uint256 indexed fromChainId, bytes32 indexed messageId);

  constructor(bytes32 _hubDispatcher, uint16 _hubChainId, IWormhole _wormholeCore, uint256 _spokeIndex) {
    HUB_DISPATCHER = _hubDispatcher;
    HUB_CHAIN_ID = _hubChainId;
    WORMHOLE_CORE = _wormholeCore;
    SPOKE_INDEX = _spokeIndex;
  }

  function _onlyAirlock() internal view {
    if (msg.sender != address(airlock)) revert InvalidCaller();
  }

  // TODO: Double opt in necessary (propose/accept)
  function setAirlock(address _newAirlock) external {
    _onlyAirlock();
    airlock = SpokeAirlock(_newAirlock);
  }

  function receiveMessage(bytes memory _encodedMessage) public {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);

    if (!valid) revert InvalidWormholeMessage(reason);

    if (wormholeMessage.emitterAddress != HUB_DISPATCHER || wormholeMessage.emitterChainId != HUB_CHAIN_ID) {
      revert UnknownMessageEmitter();
    }

    (uint256 bitfield, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
      abi.decode(wormholeMessage.payload, (uint256, address[], uint256[], bytes[]));

    _validateBitfieldForChain(bitfield);

    // TODO: Need proposalId or descriptionHash?
    airlock.executeOperations(targets, values, calldatas);
  }

  function _validateBitfieldForChain(uint256 _bitfield) internal view {
    if (!isBitSet(_bitfield, SPOKE_INDEX)) revert InvalidWormholeMessage("Bitfield does not include chain index");
  }

  function isBitSet(uint256 b, uint256 pos) internal pure returns (bool) {
    return ((b >> pos) & 1) == 1;
  }
}
