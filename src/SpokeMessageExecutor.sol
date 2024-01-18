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

  error AlreadyProcessedMessage();
  error InvalidCaller();
  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  event ProposalExecuted(uint256 proposalId);

  mapping(bytes32 messageHash => bool exectured) public messageReceived;

  constructor(bytes32 _hubDispatcher, uint16 _hubChainId, IWormhole _wormholeCore, uint256 _spokeIndex) {
    HUB_DISPATCHER = _hubDispatcher;
    HUB_CHAIN_ID = _hubChainId;
    WORMHOLE_CORE = _wormholeCore;
    SPOKE_INDEX = _spokeIndex;
  }

  function _onlyAirlock() internal view {
    if (msg.sender != address(airlock)) revert InvalidCaller();
  }

  // TODO: Double opt in necessary? (propose/accept)
  function setAirlock(address _newAirlock) external {
    _onlyAirlock();
    airlock = SpokeAirlock(_newAirlock);
  }

  function _validateBitfieldForChain(uint256 _bitfield) internal view {
    if (!_isBitSet(_bitfield, SPOKE_INDEX)) revert InvalidWormholeMessage("Bitfield does not include chain index");
  }

  function _isBitSet(uint256 b, uint256 pos) internal pure returns (bool) {
    return ((b >> pos) & 1) == 1;
  }

  function receiveMessage(bytes memory _encodedMessage) external payable {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);

    if (!valid) revert InvalidWormholeMessage(reason);
    // Replay protection
    if (messageReceived[wormholeMessage.hash]) revert AlreadyProcessedMessage();

    if (wormholeMessage.emitterAddress != HUB_DISPATCHER || wormholeMessage.emitterChainId != HUB_CHAIN_ID) {
      revert UnknownMessageEmitter();
    }

    (
      uint256 _proposalId,
      uint256 _bitfield,
      address[] memory _targets,
      uint256[] memory _values,
      bytes[] memory _calldatas
    ) = abi.decode(wormholeMessage.payload, (uint256, uint256, address[], uint256[], bytes[]));

    _validateBitfieldForChain(_bitfield);

    // TODO: Need proposalId or descriptionHash?
    airlock.executeOperations(_targets, _values, _calldatas);
    messageReceived[wormholeMessage.hash] = true;
    emit ProposalExecuted(_proposalId);
  }
}
