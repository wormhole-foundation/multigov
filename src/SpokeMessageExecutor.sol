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
  uint16 public immutable SPOKE_CHAIN_ID;
  bool private _initialized = false;
  SpokeAirlock public airlock;

  error AlreadyProcessedMessage();
  error AlreadyInitialized();
  error InvalidCaller();
  error InvalidWormholeMessage(string);
  error InvalidSpokeExecutorOperationLength(uint256, uint256, uint256);
  error UnknownMessageEmitter();

  event ProposalExecuted(uint256 proposalId);

  mapping(bytes32 messageHash => bool executed) public messageReceived;

  constructor(bytes32 _hubDispatcher, uint16 _hubChainId, IWormhole _wormholeCore, uint16 _spokeChainId) {
    HUB_DISPATCHER = _hubDispatcher;
    HUB_CHAIN_ID = _hubChainId;
    WORMHOLE_CORE = _wormholeCore;
    SPOKE_CHAIN_ID = _spokeChainId;
  }

  function initialize(address payable _airlock) external {
    if (_initialized) revert AlreadyInitialized();
    airlock = SpokeAirlock(_airlock);
    _initialized = true;
  }

  function _onlyAirlock() internal view {
    if (msg.sender != address(airlock)) revert InvalidCaller();
  }

  // TODO: Double opt in necessary? (propose/accept)
  function setAirlock(address payable _newAirlock) external {
    _onlyAirlock();
    airlock = SpokeAirlock(_newAirlock);
  }

  function _validateChainId(uint16 _messageChainId) internal view {
    if (SPOKE_CHAIN_ID != _messageChainId) revert InvalidWormholeMessage("Message is not meant for this chain.");
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
      uint256 _messageId,
      uint16 _wormholeChainId,
      address[] memory _targets,
      uint256[] memory _values,
      bytes[] memory _calldatas
    ) = abi.decode(wormholeMessage.payload, (uint256, uint16, address[], uint256[], bytes[]));

    if (_targets.length != _values.length || _targets.length != _calldatas.length) {
      revert InvalidSpokeExecutorOperationLength(_targets.length, _values.length, _calldatas.length);
    }

    _validateChainId(_wormholeChainId);

    // TODO: Need proposalId or descriptionHash?
    // Should there be a deadline
    airlock.executeOperations(_targets, _values, _calldatas);
    messageReceived[wormholeMessage.hash] = true;
    emit ProposalExecuted(_messageId);
  }
}
