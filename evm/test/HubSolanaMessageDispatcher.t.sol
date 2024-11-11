// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {CHAIN_ID_SOLANA} from "wormhole-sdk/Chains.sol";
import {InvalidChainId} from "wormhole-sdk/QueryResponse.sol";
import {HubSolanaMessageDispatcher} from "src/HubSolanaMessageDispatcher.sol";
import {IMessageDispatcher} from "src/interfaces/IMessageDispatcher.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {WormholeCoreMock} from "test/mocks/WormholeCoreMock.sol";
import {TestConstants} from "test/TestConstants.sol";

contract HubSolanaMessageDispatcherTest is Test, TestConstants {
  HubSolanaMessageDispatcher dispatcher;
  WormholeCoreMock wormholeCoreMock;

  uint8 DISPATCH_CONSISTENCY_LEVEL = 0;

  function setUp() public virtual {
    wormholeCoreMock = new WormholeCoreMock(CHAIN_ID_SOLANA);
    TimelockControllerFake timelock = TimelockControllerFake(payable(address(this)));
    dispatcher =
      new HubSolanaMessageDispatcher(address(timelock), address(wormholeCoreMock), DISPATCH_CONSISTENCY_LEVEL);
  }

  function _createSolanaInstruction(
    bytes32 _programId,
    bytes32[5] memory _accountPubkeys,
    bool[5] memory _isSigners,
    bool[5] memory _isWritables,
    bytes memory _data
  ) internal pure returns (HubSolanaMessageDispatcher.SolanaInstruction memory) {
    HubSolanaMessageDispatcher.SolanaAccountMeta[] memory accounts =
      new HubSolanaMessageDispatcher.SolanaAccountMeta[](_accountPubkeys.length);

    for (uint256 i = 0; i < _accountPubkeys.length; i++) {
      accounts[i] = HubSolanaMessageDispatcher.SolanaAccountMeta({
        pubkey: _accountPubkeys[i],
        isSigner: _isSigners[i],
        isWritable: _isWritables[i]
      });
    }

    return HubSolanaMessageDispatcher.SolanaInstruction({programId: _programId, accounts: accounts, data: _data});
  }
}

contract Constructor is HubSolanaMessageDispatcherTest {
  function testFuzz_CorrectlySetsConstructorArgs(
    address _timelock,
    address _wormholeCore,
    uint8 _dispatchConsistencyLevel
  ) public {
    vm.assume(_timelock != address(0));
    HubSolanaMessageDispatcher dispatcher =
      new HubSolanaMessageDispatcher(_timelock, _wormholeCore, _dispatchConsistencyLevel);
    assertEq(address(dispatcher.owner()), _timelock);
    assertEq(address(dispatcher.wormholeCore()), _wormholeCore);
    assertEq(dispatcher.consistencyLevel(), _dispatchConsistencyLevel);
  }
}

contract Dispatch is HubSolanaMessageDispatcherTest {
  function testFuzz_CorrectlyEncodeMessageSingleInstruction(
    bytes32 _programId,
    bytes32[5] memory _accountPubkeys,
    bool[5] memory _isSigners,
    bool[5] memory _isWritables,
    bytes memory _instructionData
  ) public {
    HubSolanaMessageDispatcher.SolanaInstruction[] memory instructions =
      new HubSolanaMessageDispatcher.SolanaInstruction[](1);
    instructions[0] = _createSolanaInstruction(_programId, _accountPubkeys, _isSigners, _isWritables, _instructionData);

    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(CHAIN_ID_SOLANA, instructions);
    bytes memory emittedPayload = abi.encode(nextMessageId, CHAIN_ID_SOLANA, instructions);

    dispatcher.dispatch(payload);

    assertEq(wormholeCoreMock.ghostPublishMessagePayload(), emittedPayload);
  }

  function testFuzz_CorrectlyEncodeMultipleInstructions(
    bytes32[3] memory _programIds,
    bytes32[5][5] memory _accountPubkeys,
    bool[5][5] memory _isSigners,
    bool[5][5] memory _isWritables,
    bytes[3] memory _instructionData
  ) public {
    HubSolanaMessageDispatcher.SolanaInstruction[] memory instructions =
      new HubSolanaMessageDispatcher.SolanaInstruction[](3);

    for (uint8 i = 0; i < 3; i++) {
      instructions[i] = _createSolanaInstruction(
        _programIds[i], _accountPubkeys[i], _isSigners[i], _isWritables[i], _instructionData[i]
      );
    }

    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(CHAIN_ID_SOLANA, instructions);
    bytes memory emittedPayload = abi.encode(nextMessageId, CHAIN_ID_SOLANA, instructions);

    dispatcher.dispatch(payload);

    assertEq(wormholeCoreMock.ghostPublishMessagePayload(), emittedPayload);
  }

  function testFuzz_EmitsAMessageDispatchedEvent(
    bytes32 _programId,
    bytes32[5] memory _accountPubkeys,
    bool[5] memory _isSigners,
    bool[5] memory _isWritables,
    bytes memory _instructionData
  ) public {
    vm.assume(_accountPubkeys.length == _isSigners.length && _accountPubkeys.length == _isWritables.length);

    HubSolanaMessageDispatcher.SolanaInstruction[] memory instructions =
      new HubSolanaMessageDispatcher.SolanaInstruction[](1);
    instructions[0] = _createSolanaInstruction(_programId, _accountPubkeys, _isSigners, _isWritables, _instructionData);

    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(CHAIN_ID_SOLANA, instructions);
    bytes memory emittedPayload = abi.encode(nextMessageId, CHAIN_ID_SOLANA, instructions);

    vm.expectEmit();
    emit IMessageDispatcher.MessageDispatched(nextMessageId, emittedPayload);
    dispatcher.dispatch(payload);
  }

  function testFuzz_RevertIf_InvalidChainId(uint16 _invalidChainId) public {
    vm.assume(_invalidChainId != CHAIN_ID_SOLANA);

    HubSolanaMessageDispatcher.SolanaInstruction[] memory instructions =
      new HubSolanaMessageDispatcher.SolanaInstruction[](1);
    bytes memory payload = abi.encode(_invalidChainId, instructions);

    vm.expectRevert(InvalidChainId.selector);
    dispatcher.dispatch(payload);
  }

  function test_RevertIf_EmptyInstructionSet() public {
    HubSolanaMessageDispatcher.SolanaInstruction[] memory instructions =
      new HubSolanaMessageDispatcher.SolanaInstruction[](0);
    bytes memory payload = abi.encode(CHAIN_ID_SOLANA, instructions);

    vm.expectRevert(HubSolanaMessageDispatcher.EmptyInstructionSet.selector);
    dispatcher.dispatch(payload);
  }
}
