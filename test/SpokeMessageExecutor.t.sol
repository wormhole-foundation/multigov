// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {WormholeMock} from "wormhole-sdk/testing/helpers/WormholeMock.sol";


import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";

contract SpokeMessageExecutorTest is Test {
  SpokeMessageExecutor executor;
  function setUp() public {
    WormholeMock wormholeCoreMock = new WormholeMock();
	uint16 WORMHOLE_SPOKE_CHAIN = 24; // Optimism
	uint16 WORMHOLE_HUB_CHAIN = 2; // Optimism
	address hubDispatcher = makeAddr("Hub dispatcher");
    executor = new SpokeMessageExecutor(WORMHOLE_HUB_CHAIN, hubDispatcher, IWormhole(address(wormholeCoreMock)), WORMHOLE_SPOKE_CHAIN);
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

contract ReceiveMessage is SpokeMessageExecutorTest {
		// 1. Test parsing and verifying 
		// 2. Test If message has already been processed
		// 3. Test hub dispatcher is not the set hub dispatcher
		// 4. Test the message came from a different chain
		// 5. Test message is not meant for this chain
		// 6. Test execute executes calldata, and message is processed
		// 7. Test event is emitted
		function testFuzz_basic(bytes memory payload) public {
				executor.receiveMessage(payload);
		}
}
