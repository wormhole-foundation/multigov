// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {CHAIN_ID_SOLANA} from "wormhole-sdk/Chains.sol";
import {InvalidChainId} from "wormhole-sdk/QueryResponse.sol";
import {WormholeDispatcher} from "src/WormholeDispatcher.sol";
import {IMessageDispatcher} from "src/interfaces/IMessageDispatcher.sol";

/// @title HubSolanaMessageDispatcher
/// @author [ScopeLift](https://scopelift.co)
/// @notice A contract that will publish a message that can be relayed to the appropriate `SpokeExecutor` on Solana.
contract HubSolanaMessageDispatcher is WormholeDispatcher, IMessageDispatcher {
  /// @notice The id for the next message published.
  /// @dev This value is incremented after each successful message dispatch.
  uint256 public nextMessageId = 1;

  /// @notice Thrown if the instruction set is empty.
  error EmptyInstructionSet();

  /// @notice Thrown if the value is not zero.
  error InvalidValue();

  /// @param _timelock The timelock that will call the hub dispatcher to initiate a cross chain execution.
  /// @param _core The Wormhole contract that will handle publishing the cross chain message.
  /// @param _dispatchConsistencyLevel The consistency level of a message when sending it to another chain. In most
  /// situations this should be set to finalized.
  constructor(address _timelock, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(_timelock, _core, _dispatchConsistencyLevel)
  {}

  /// @notice A struct that represents a Solana account meta.
  /// @dev This structure mirrors Solana's AccountMeta structure.
  struct SolanaAccountMeta {
    /// @notice The public key of the account (32-byte address).
    bytes32 pubkey;
    /// @notice Whether the account is a signer on the instruction.
    bool isSigner;
    /// @notice Whether the account's data may be mutated.
    bool isWritable;
  }

  /// @notice A struct that represents a Solana instruction.
  /// @dev This structure mirrors Solana's Instruction structure.
  struct SolanaInstruction {
    /// @notice The program ID that will process this instruction (32-byte address).
    bytes32 programId;
    /// @notice The accounts involved in this instruction.
    SolanaAccountMeta[] accounts;
    /// @notice The instruction data (opaque byte array).
    bytes data;
  }

  /// @notice Publishes a message to be sent to the appropriate `SpokeMessageExecutor` on Solana for cross chain
  /// execution.
  /// @dev This function encodes the message, publishes it via Wormhole, and emits an event.
  /// Note that Solana has transaction size limits which are not enforced here.
  /// @param _payload An encoding of the target wormhole chain id and the Solana instructions to be executed.
  function dispatch(bytes calldata _payload) external payable {
    _checkOwner();

    if (msg.value > 0) revert InvalidValue();

    (uint16 _wormholeChainId, SolanaInstruction[] memory instructions) =
      abi.decode(_payload, (uint16, SolanaInstruction[]));

    if (_wormholeChainId != CHAIN_ID_SOLANA) revert InvalidChainId();
    if (instructions.length == 0) revert EmptyInstructionSet();

    bytes memory payload = abi.encode(nextMessageId, _wormholeChainId, instructions.length, instructions);
    _publishMessage(payload, msg.value);

    emit MessageDispatched(nextMessageId, payload);
    nextMessageId++;
  }
}
