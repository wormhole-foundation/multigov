// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";
import {IMessageDispatcher} from "src/interfaces/IMessageDispatcher.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {WormholeCoreMock} from "test/mocks/WormholeCoreMock.sol";
import {TestConstants} from "test/TestConstants.sol";

contract HubMessageDispatcherTest is Test, TestConstants {
  HubMessageDispatcher dispatcher;
  WormholeCoreMock wormholeCoreMock;

  function setUp() public virtual {
    wormholeCoreMock = new WormholeCoreMock(2);
    TimelockControllerFake timelock = TimelockControllerFake(payable(address(this)));
    dispatcher = new HubMessageDispatcher(address(timelock), address(wormholeCoreMock), 0);
  }
}

contract Constructor is HubMessageDispatcherTest {
  function testFuzz_CorrectlySetsConstructorArgs(
    address _timelock,
    address _wormholeCore,
    uint8 _dispatchConsistencyLevel
  ) public {
    vm.assume(_timelock != address(0));
    HubMessageDispatcher _dispatcher = new HubMessageDispatcher(_timelock, _wormholeCore, _dispatchConsistencyLevel);
    assertEq(address(_dispatcher.owner()), _timelock);
    assertEq(address(_dispatcher.wormholeCore()), _wormholeCore);
    assertEq(_dispatcher.consistencyLevel(), _dispatchConsistencyLevel);
  }
}

contract Dispatch is HubMessageDispatcherTest {
  ProposalBuilder builder = new ProposalBuilder();

  function setUp() public override {
    super.setUp();
    builder = new ProposalBuilder();
  }

  function _addCrossChainCall(bytes memory _callData) public {
    builder.push(makeAddr("spokeContractCall"), 0, _callData);
  }

  function testFuzz_CorrectlyEncodeProposalSinglePayload(
    uint32 _votingPeriod,
    string memory _description,
    uint16 _wormholeChainId
  ) public {
    _addCrossChainCall(abi.encodeWithSignature("setVotingPeriod(uint32)", _votingPeriod));
    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(
      _wormholeChainId, builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description))
    );
    dispatcher.dispatch(payload);
    assertEq(
      wormholeCoreMock.ghostPublishMessagePayload(),
      abi.encode(nextMessageId, _wormholeChainId, builder.targets(), builder.values(), builder.calldatas())
    );
  }

  function testFuzz_CorrectlyEncodeProposalMultiplePayload(
    uint32 _votingPeriod,
    string memory _description,
    uint16 _wormholeChainId
  ) public {
    _addCrossChainCall(abi.encodeWithSignature("setVotingPeriod(uint32)", _votingPeriod));
    _addCrossChainCall(abi.encodeWithSignature("setVotingPeriod(uint32)", _votingPeriod));
    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(
      _wormholeChainId, builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description))
    );
    dispatcher.dispatch(payload);
    assertEq(
      wormholeCoreMock.ghostPublishMessagePayload(),
      abi.encode(nextMessageId, _wormholeChainId, builder.targets(), builder.values(), builder.calldatas())
    );
  }

  function testFuzz_EmitsAMessageDispatchedEvent(
    uint32 _votingPeriod,
    string memory _description,
    uint16 _wormholeChainId
  ) public {
    _addCrossChainCall(abi.encodeWithSignature("setVotingPeriod(uint32)", _votingPeriod));
    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(
      _wormholeChainId, builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description))
    );
    bytes memory emittedPayload =
      abi.encode(nextMessageId, _wormholeChainId, builder.targets(), builder.values(), builder.calldatas());

    vm.expectEmit();
    emit IMessageDispatcher.MessageDispatched(nextMessageId, emittedPayload);
    dispatcher.dispatch(payload);
  }

  function testFuzz_RevertIf_ProposalDataIsDifferentLengths(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description,
    uint16 _wormholeChainId
  ) public {
    vm.assume(_targets.length != _values.length || _calldatas.length != _targets.length);
    bytes memory payload = abi.encode(_wormholeChainId, _targets, _values, _calldatas, keccak256(bytes(_description)));

    vm.expectRevert(
      abi.encodeWithSelector(
        HubMessageDispatcher.InvalidSpokeExecutorOperationLength.selector,
        _targets.length,
        _values.length,
        _calldatas.length
      )
    );
    dispatcher.dispatch(payload);
  }
}
