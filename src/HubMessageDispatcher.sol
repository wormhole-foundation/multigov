// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {WormholeDispatcher} from "src/WormholeDispatcher.sol";

contract HubMessageDispatcher is WormholeDispatcher {
  event MessageDispatched(uint256 indexed proposalId, bytes payload);

  uint256 public nextMessageId = 1;

  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  // Opting for single call because handling failure cases will be much easier.
  // And the calldata will be simpler to put together.
  function dispatch(bytes calldata _payload) external {
    _checkOwner();

    (uint16 wormholeChainId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
      abi.decode(_payload, (uint16, address[], uint256[], bytes[]));

    bytes memory payload = abi.encode(nextMessageId, wormholeChainId, targets, values, calldatas);
    _publishMessage(payload);
    emit MessageDispatched(nextMessageId, payload);
    nextMessageId += 1;
  }
}
