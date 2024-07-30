// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {WormholeDispatcher} from "src/WormholeDispatcher.sol";

contract HubMessageDispatcher is WormholeDispatcher {
  uint256 public nextMessageId = 1;

  error InvalidSpokeExecutorOperationLength(uint256, uint256, uint256);

  event MessageDispatched(uint256 indexed proposalId, bytes payload);

  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  function dispatch(bytes calldata _payload) external {
    _checkOwner();

    (uint16 wormholeChainId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
      abi.decode(_payload, (uint16, address[], uint256[], bytes[]));

    if (targets.length != values.length || targets.length != calldatas.length) {
      revert InvalidSpokeExecutorOperationLength(targets.length, values.length, calldatas.length);
    }

    bytes memory payload = abi.encode(nextMessageId, wormholeChainId, targets, values, calldatas);
    _publishMessage(payload);
    emit MessageDispatched(nextMessageId, payload);
    nextMessageId += 1;
  }
}
