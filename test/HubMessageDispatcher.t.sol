// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";

import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";
import {GovernorVoteFake} from "test/fakes/GovernorVoteFake.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {WormholeCoreMock} from "test/mocks/WormholeCoreMock.sol";
import {TestConstants} from "test/TestConstants.sol";

contract HubMessageDispatcherTest is Test, TestConstants {
  HubMessageDispatcher dispatcher;
  WormholeCoreMock wormholeCoreMock;
  GovernorVoteFake governor;

  function setUp() public {
    wormholeCoreMock = new WormholeCoreMock();
    ERC20VotesFake token = new ERC20VotesFake();
    TimelockControllerFake timelock = TimelockControllerFake(payable(address(this)));
    governor = new GovernorVoteFake("Example", token, timelock);
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
  function testFuzz_CorrectlyEncodeProposalPayload(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description,
    uint16 _wormholeChainId
  ) public {
    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(_wormholeChainId, _targets, _values, _calldatas, keccak256(bytes(_description)));
    dispatcher.dispatch(payload);
    assertEq(
      wormholeCoreMock.ghostPublishMessagePayload(),
      abi.encode(nextMessageId, _wormholeChainId, _targets, _values, _calldatas)
    );
  }

  function testFuzz_DispatchingProposalEmitsAMessageDispatchedEvent(
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description,
    uint16 _wormholeChainId
  ) public {
    uint256 nextMessageId = dispatcher.nextMessageId();
    bytes memory payload = abi.encode(_wormholeChainId, _targets, _values, _calldatas, keccak256(bytes(_description)));
    bytes memory emittedPayload = abi.encode(nextMessageId, _wormholeChainId, _targets, _values, _calldatas);

    vm.expectEmit();
    emit HubMessageDispatcher.MessageDispatched(nextMessageId, emittedPayload);
    dispatcher.dispatch(payload);
  }
}
