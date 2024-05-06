// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";

import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {TestConstants} from "test/TestConstants.sol";

contract HubMessageDispatcherTest is Test, TestConstants {
  // Setup dispatcher
  // test dispatch
  // 1. Test data is encoded properly
  // 2. Test that the payload emits the appropriate event
  // 3. Test the message payload is sent by wormhole core
  // 4. Test the proposal id matches the id of the proposal

  function setUp() public {
    TimelockControllerFake _timelock = TimelockControllerFake(payable(address(this)));
    new HubMessageDispatcher(address(_timelock), WORMHOLE_MAINNET_CORE_RELAYER, 0);
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

// contract Dispatch is HubMessageDispatcher {
// 		function testFuzz_CorrectlyEncodeProposalPayload() public {
// 				//
// 		}
// }
