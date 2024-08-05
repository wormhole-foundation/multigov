// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {Structs} from "wormhole/Structs.sol";
import {WormholeCoreMock} from "test/mocks/WormholeCoreMock.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

contract SpokeMessageExecutorTest is Test {
  ERC20VotesFake public token;
  SpokeMessageExecutor executor;
  SpokeAirlock airlock;
  uint16 WORMHOLE_HUB_CHAIN = 2; // Mainnet
  uint16 WORMHOLE_SPOKE_CHAIN = 24; // Optimism
  address hubDispatcher = makeAddr("Hub dispatcher");
  WormholeCoreMock wormholeCoreMock = new WormholeCoreMock();

  function setUp() public {
    token = new ERC20VotesFake();
    executor = new SpokeMessageExecutor(
      bytes32(uint256(uint160(hubDispatcher))),
      WORMHOLE_HUB_CHAIN,
      IWormhole(address(wormholeCoreMock)),
      WORMHOLE_SPOKE_CHAIN
    );
    airlock = new SpokeAirlock(address(executor));
    executor.initialize(payable(airlock));
  }

  // Create a proposal that can be voted on
  function _createMintProposal(address _account, uint208 _amount) public returns (ProposalBuilder) {
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(token), 0, abi.encodeWithSignature("mint(address,uint208)", _account, _amount));
    return builder;
  }
}

contract Constructor is SpokeMessageExecutorTest {
  function testFuzz_CorrectlySetConstructorArgs(
    bytes32 _hubDispatcher,
    uint16 _hubChainId,
    address _wormholeCore,
    uint16 _spokeChainId
  ) public {
    SpokeMessageExecutor executor =
      new SpokeMessageExecutor(_hubDispatcher, _hubChainId, IWormhole(_wormholeCore), _spokeChainId);
    assertEq(executor.HUB_DISPATCHER(), _hubDispatcher);
    assertEq(executor.HUB_CHAIN_ID(), _hubChainId);
    assertEq(address(executor.WORMHOLE_CORE()), _wormholeCore);
    assertEq(executor.SPOKE_CHAIN_ID(), _spokeChainId);
  }
}

contract Initialize is SpokeMessageExecutorTest {
  function testFuzz_CorrectlyInitialize(address payable _airlock) public {
    SpokeMessageExecutor spokeExecutor = new SpokeMessageExecutor(
      bytes32(uint256(uint160(hubDispatcher))),
      WORMHOLE_HUB_CHAIN,
      IWormhole(address(wormholeCoreMock)),
      WORMHOLE_SPOKE_CHAIN
    );
    spokeExecutor.initialize(_airlock);
    assertEq(_airlock, payable(spokeExecutor.airlock()));
  }

  function testFuzz_RevertIf_CalledTwice(address payable _updatedAirlock) public {
    SpokeMessageExecutor spokeExecutor = new SpokeMessageExecutor(
      bytes32(uint256(uint160(hubDispatcher))),
      WORMHOLE_HUB_CHAIN,
      IWormhole(address(wormholeCoreMock)),
      WORMHOLE_SPOKE_CHAIN
    );
    spokeExecutor.initialize(payable(airlock));

    vm.expectRevert(SpokeMessageExecutor.AlreadyInitialized.selector);
    spokeExecutor.initialize(_updatedAirlock);
  }
}

contract SetAirlock is SpokeMessageExecutorTest {
  function testFuzz_CanBeCalledByAirlock(address payable _newAirlock) public {
    vm.prank(address(airlock));
    executor.setAirlock(_newAirlock);
    assertEq(payable(executor.airlock()), _newAirlock);
  }

  function testFuzz_RevertIf_NotCalledByAirlock(address payable _newAirlock, address _caller) public {
    vm.assume(_caller != address(airlock));
    vm.prank(address(airlock));
    executor.setAirlock(_newAirlock);
    assertEq(payable(executor.airlock()), _newAirlock);
  }
}

contract ReceiveMessage is SpokeMessageExecutorTest {
  function _buildVm(
    uint32 _timestamp,
    uint32 _nonce,
    uint16 _emitterChainId,
    bytes32 _emitterAddress,
    uint64 _sequence,
    uint8 _consistencyLevel,
    bytes memory _payload
  ) public pure returns (bytes memory, bytes32) {
    Structs.Signature[] memory sigs = new Structs.Signature[](1);
    sigs[0] = Structs.Signature("", "", 0, 0);
    bytes32 hash = keccak256(
      abi.encodePacked(
        keccak256(
          abi.encodePacked(_timestamp, _nonce, _emitterChainId, _emitterAddress, _sequence, _consistencyLevel, _payload)
        )
      )
    );
    Structs.VM memory vm = Structs.VM({
      version: 0,
      timestamp: _timestamp,
      nonce: _nonce,
      emitterChainId: _emitterChainId,
      emitterAddress: _emitterAddress,
      sequence: _sequence,
      consistencyLevel: _consistencyLevel,
      payload: _payload,
      guardianSetIndex: 0,
      signatures: sigs,
      hash: hash
    });
    return (abi.encode(vm), hash);
  }

  function testFuzz_ReceiveMessageWithCorrectData(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount
  ) public {
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa, bytes32 hash) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );
    executor.receiveMessage(vaa);
    bool messageReceived = executor.messageReceived(hash);
    uint256 balance = token.balanceOf(account);
    assertTrue(messageReceived);
    assertEq(balance, _amount);
  }

  function testFuzz_ReceiveMessageEmitsProposalExecutedEvent(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint16 _emitterChainId,
    address _emitterChainAddress
  ) public {
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, 1);
    SpokeMessageExecutor executor = new SpokeMessageExecutor(
      bytes32(uint256(uint160(_emitterChainAddress))),
      _emitterChainId,
      IWormhole(address(wormholeCoreMock)),
      WORMHOLE_SPOKE_CHAIN
    );
    SpokeAirlock airlock = new SpokeAirlock(address(executor));
    executor.initialize(payable(airlock));

    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      _emitterChainId,
      bytes32(uint256(uint160(_emitterChainAddress))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectEmit();
    emit SpokeMessageExecutor.ProposalExecuted(
      _emitterChainId, bytes32(uint256(uint160(_emitterChainAddress))), _messageId
    );

    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_AlreadyProcessedMessage(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount
  ) public {
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );
    executor.receiveMessage(vaa);
    vm.expectRevert(SpokeMessageExecutor.AlreadyProcessedMessage.selector);
    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_EmitterIsNotTheHubDispatcher(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount,
    address _dispatcher
  ) public {
    vm.assume(_dispatcher != hubDispatcher);
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(_dispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectRevert(SpokeMessageExecutor.UnknownMessageEmitter.selector);
    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_EmitterIsNotTheHubDispatcherChain(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount,
    uint16 _dispatcherChainId
  ) public {
    vm.assume(_dispatcherChainId != WORMHOLE_HUB_CHAIN);
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      _dispatcherChainId,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectRevert(SpokeMessageExecutor.UnknownMessageEmitter.selector);
    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_LengthOfOperationTargetsIsNotTheSame(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount
  ) public {
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, new address[](0), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectRevert(abi.encodeWithSelector(SpokeMessageExecutor.InvalidSpokeExecutorOperationLength.selector, 0, 1, 1));
    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_LengthOfOperationValuesIsNotTheSame(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount
  ) public {
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), new address[](0), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectRevert(abi.encodeWithSelector(SpokeMessageExecutor.InvalidSpokeExecutorOperationLength.selector, 1, 0, 1));
    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_LengthOfOperationCalldatasIsNotTheSame(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount
  ) public {
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), new address[](0));
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectRevert(abi.encodeWithSelector(SpokeMessageExecutor.InvalidSpokeExecutorOperationLength.selector, 1, 1, 0));
    executor.receiveMessage(vaa);
  }

  function testFuzz_RevertIf_MessageMeantForADifferentSpokeChain(
    uint32 _timestamp,
    uint32 _nonce,
    uint64 _sequence,
    uint8 _consistencyLevel,
    uint256 _messageId,
    uint208 _amount,
    uint16 _targetChainId
  ) public {
    vm.assume(_targetChainId != WORMHOLE_SPOKE_CHAIN);
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, _amount);
    bytes memory _payload =
      abi.encode(_messageId, _targetChainId, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      _timestamp,
      _nonce,
      WORMHOLE_HUB_CHAIN,
      bytes32(uint256(uint160(hubDispatcher))),
      _sequence,
      _consistencyLevel,
      _payload
    );

    vm.expectRevert(
      abi.encodeWithSelector(
        SpokeMessageExecutor.InvalidWormholeMessage.selector, "Message is not meant for this chain."
      )
    );
    executor.receiveMessage(vaa);
  }
}
