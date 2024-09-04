// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {Structs} from "wormhole/Structs.sol";
import {WormholeCoreMock} from "test/mocks/WormholeCoreMock.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {SpokeMessageExecutorV2Fake} from "test/fakes/SpokeMessageExecutorV2Fake.sol";

contract SpokeMessageExecutorTest is Test {
  ERC20VotesFake public token;
  SpokeMessageExecutor executor;
  SpokeAirlock airlock;
  uint16 WORMHOLE_HUB_CHAIN = 2; // Mainnet
  uint16 WORMHOLE_SPOKE_CHAIN = 24; // Optimism
  address hubDispatcher = makeAddr("Hub dispatcher");
  WormholeCoreMock wormholeCoreMock = new WormholeCoreMock(WORMHOLE_SPOKE_CHAIN);

  function setUp() public {
    token = new ERC20VotesFake();
    address deployer = makeAddr("Deployer");

    SpokeMessageExecutor impl = new SpokeMessageExecutor(deployer);
    vm.prank(deployer);
    ERC1967Proxy proxy = new ERC1967Proxy(
      address(impl),
      abi.encodeCall(
        SpokeMessageExecutor.initialize,
        (bytes32(uint256(uint160(hubDispatcher))), WORMHOLE_HUB_CHAIN, address(wormholeCoreMock))
      )
    );
    executor = SpokeMessageExecutor(address(proxy));
    airlock = executor.airlock();
  }

  // Create a proposal that can be voted on
  function _createMintProposal(address _account, uint208 _amount) public returns (ProposalBuilder) {
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(token), 0, abi.encodeWithSignature("mint(address,uint208)", _account, _amount));
    return builder;
  }
}

contract Initialize is SpokeMessageExecutorTest {
  function testFuzz_CorrectlyInitialize(address _deployer, bytes32 _hubDispatcher, uint16 _hubChainId) public {
    SpokeMessageExecutor impl = new SpokeMessageExecutor(_deployer);
    vm.prank(_deployer);
    ERC1967Proxy proxy = new ERC1967Proxy(
      address(impl),
      abi.encodeCall(SpokeMessageExecutor.initialize, (_hubDispatcher, _hubChainId, address(wormholeCoreMock)))
    );

    SpokeMessageExecutor spokeExecutor = SpokeMessageExecutor(address(proxy));

    assertEq(spokeExecutor.hubDispatcher(), _hubDispatcher);
    assertEq(spokeExecutor.hubChainId(), _hubChainId);
    assertEq(spokeExecutor.spokeChainId(), WORMHOLE_SPOKE_CHAIN);
    assertEq(address(spokeExecutor.wormholeCore()), address(wormholeCoreMock));
    assertEq(spokeExecutor.DEPLOYER(), _deployer);
  }

  function testFuzz_CorrectlyUpgradeToNewImplementation(address _deployer, uint256 _initialValue) public {
    SpokeMessageExecutorV2Fake impl = new SpokeMessageExecutorV2Fake(_deployer);
    vm.prank(address(airlock));
    executor.upgradeToAndCall(
      address(impl), abi.encodeCall(SpokeMessageExecutorV2Fake.initializeFakeV2, (_initialValue))
    );
    assertEq(SpokeMessageExecutorV2Fake(address(executor)).fakeStateVar(), _initialValue);
  }

  function testFuzz_RevertIf_AirlockDoesNotInitiateUpgrade(address _deployer, uint256 _initialValue, address _caller)
    public
  {
    vm.assume(_caller != address(airlock));
    SpokeMessageExecutorV2Fake impl = new SpokeMessageExecutorV2Fake(_deployer);
    vm.prank(_caller);
    vm.expectRevert(SpokeMessageExecutor.InvalidCaller.selector);
    executor.upgradeToAndCall(
      address(impl), abi.encodeCall(SpokeMessageExecutorV2Fake.initializeFakeV2, (_initialValue))
    );
  }

  function testFuzz_RevertIf_CalledTwice(bytes32 _hubDispatcher, uint16 _hubChainId, address _wormholeCore) public {
    vm.expectRevert(Initializable.InvalidInitialization.selector);
    executor.initialize(_hubDispatcher, _hubChainId, _wormholeCore);
  }

  function testFuzz_RevertIf_NotDeployer(
    address _deployer,
    address _notDeployer,
    bytes32 _hubDispatcher,
    uint16 _hubChainId,
    address _wormholeCore
  ) public {
    vm.assume(_notDeployer != _deployer);
    SpokeMessageExecutor impl = new SpokeMessageExecutor(_deployer);

    vm.prank(_deployer);
    ERC1967Proxy proxy = new ERC1967Proxy(address(impl), "");

    SpokeMessageExecutor executor = SpokeMessageExecutor(address(proxy));

    vm.prank(_notDeployer);
    vm.expectRevert(SpokeMessageExecutor.OnlyDeployer.selector);
    executor.initialize(_hubDispatcher, _hubChainId, _wormholeCore);
  }
}

contract SetHubDispatcher is SpokeMessageExecutorTest {
  function testFuzz_DispatcherCanBeUpdated(bytes32 _newDispatcher) public {
    vm.prank(address(airlock));
    executor.setHubDispatcher(_newDispatcher);
    assertEq(executor.hubDispatcher(), _newDispatcher);
  }

  function testFuzz_EmitsHubDispatcherUpdatedEvent(bytes32 _newDispatcher) public {
    bytes32 existingDispatcher = executor.hubDispatcher();
    vm.prank(address(airlock));
    vm.expectEmit();
    emit SpokeMessageExecutor.HubDispatcherUpdated(existingDispatcher, _newDispatcher);
    executor.setHubDispatcher(_newDispatcher);
  }

  function testFuzz_RevertIf_NotCalledByAirlock(bytes32 _newHubDispatcher, address _caller) public {
    vm.assume(_caller != address(airlock));
    vm.prank(address(_caller));
    vm.expectRevert(SpokeMessageExecutor.InvalidCaller.selector);
    executor.setHubDispatcher(_newHubDispatcher);
  }
}

contract SetAirlock is SpokeMessageExecutorTest {
  function testFuzz_CanBeCalledByAirlock(address payable _newAirlock) public {
    vm.prank(address(airlock));
    vm.assume(_newAirlock != address(0));
    executor.setAirlock(_newAirlock);
    assertEq(payable(executor.airlock()), _newAirlock);
  }

  function testFuzz_RevertIf_NotCalledByAirlock(address payable _newAirlock, address _caller) public {
    vm.assume(_caller != address(airlock));
    vm.prank(address(_caller));
    vm.expectRevert(SpokeMessageExecutor.InvalidCaller.selector);
    executor.setAirlock(_newAirlock);
  }

  function test_RevertIf_NewAirlockIsAddressZero() public {
    vm.prank(address(airlock));
    vm.expectRevert(SpokeMessageExecutor.InvalidSpokeAirlock.selector);
    executor.setAirlock(payable(0));
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
    address _deployer,
    uint256 _messageId,
    uint16 _emitterChainId,
    address _emitterChainAddress
  ) public {
    // build simple proposal
    address account = makeAddr("Token holder");
    ProposalBuilder builder = _createMintProposal(account, 1);
    SpokeMessageExecutor impl = new SpokeMessageExecutor(_deployer);
    vm.prank(_deployer);
    ERC1967Proxy proxy = new ERC1967Proxy(
      address(impl),
      abi.encodeCall(
        SpokeMessageExecutor.initialize,
        (bytes32(uint256(uint160(_emitterChainAddress))), _emitterChainId, address(wormholeCoreMock))
      )
    );

    SpokeMessageExecutor spokeExecutor = SpokeMessageExecutor(address(proxy));

    bytes memory _payload =
      abi.encode(_messageId, WORMHOLE_SPOKE_CHAIN, builder.targets(), builder.values(), builder.calldatas());
    (bytes memory vaa,) = _buildVm(
      uint32(block.timestamp), 0, _emitterChainId, bytes32(uint256(uint160(_emitterChainAddress))), 0, 0, _payload
    );

    vm.expectEmit();
    emit SpokeMessageExecutor.ProposalExecuted(
      _emitterChainId, bytes32(uint256(uint160(_emitterChainAddress))), _messageId
    );

    spokeExecutor.receiveMessage(vaa);
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
