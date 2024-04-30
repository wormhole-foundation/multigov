// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.23;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {WormholeDispatcher} from "src/WormholeDispatcher.sol";

contract HubMessageDispatcher is WormholeDispatcher {
  event MessageDispatched(bytes payload);

  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  function dispatch(bytes calldata _payload) external {
    _checkOwner();

    (
      uint16 wormholeChainId,
      address[] memory targets,
      uint256[] memory values,
      bytes[] memory calldatas,
      bytes32 descriptionHash
    ) = abi.decode(_payload, (uint16, address[], uint256[], bytes[], bytes32));
    uint256 proposalId = uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));

    bytes memory payload = abi.encode(proposalId, wormholeChainId, targets, values, calldatas);
    _publishMessage(payload);
    emit MessageDispatched(payload);
  }
}
