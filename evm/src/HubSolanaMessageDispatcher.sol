// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {WormholeDispatcher} from "src/WormholeDispatcher.sol";

/// @title HubSolanaMessageDispatcher
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that will publish a message that can be relayed to the appropriate `SpokeExecutor` on Solana.
contract HubSolanaMessageDispatcher is WormholeDispatcher {
  /// @notice The id for the next message published.
  /// @dev This value is incremented after each successful message dispatch.
  uint256 public nextMessageId = 1;

  /// @notice The Wormhole chain id for Solana.
  uint8 immutable SOLANA_WORMHOLE_CHAIN_ID = 1;

  /// @notice Emitted when a message is dispatched.
  event MessageDispatched(uint256 indexed messageId, bytes payload);

  /// @notice Thrown if the chain id is not Solana.
  error InvalidChainId();

  /// @notice Thrown if the instruction set is empty.
  error EmptyInstructionSet();

  /// @param _timelock The timelock that will call the hub dispatcher to initiate a cross chain execution.
  /// @param _core The Wormhole contract that will handle publishing the cross chain message.
  /// @param _dispatchConsistencyLevel The consistency level of a message when sending it to another chain. In most
  /// situations this should be set to finalized.
  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  struct SolanaAccountMeta {
    bytes32 pubkey;
    bool isSigner;
    bool isWritable;
  }

  struct SolanaInstruction {
    bytes32 programId;
    SolanaAccountMeta[] accounts;
    bytes data;
  }

  function dispatch(bytes calldata _payload) external payable {
    _checkOwner();

    (uint16 _wormholeChainId, SolanaInstruction[] memory instructions) =
      abi.decode(_payload, (uint16, SolanaInstruction[]));

    if (_wormholeChainId != SOLANA_WORMHOLE_CHAIN_ID) revert InvalidChainId();
    if (instructions.length == 0) revert EmptyInstructionSet();

    bytes memory message = abi.encode(nextMessageId, _wormholeChainId, instructions);
    _publishMessage(message, 0);

    emit MessageDispatched(nextMessageId, message);
    nextMessageId++;
  }
}
