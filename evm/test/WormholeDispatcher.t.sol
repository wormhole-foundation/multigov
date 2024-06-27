// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test, console2} from "forge-std/Test.sol";
import {WormholeMock} from "wormhole-solidity-sdk/testing/helpers/WormholeMock.sol";

import {WormholeDispatcher} from "src/WormholeDispatcher.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

contract WormholeDispatcherTest is Test {
  WormholeDispatcher dispatcher;
  WormholeMock public wormhole;
  address owner = makeAddr("WormholeDispatcher Owner");
  address core = makeAddr("WormholeCore");
  uint8 CONSISTENCY_LEVEL = 1;

  function setUp() public {
    dispatcher = new WormholeDispatcher(owner, core, CONSISTENCY_LEVEL);
  }
}

contract Constructor is Test {
  function testFuzz_CorrectlySetConstructorArgs(address _owner, address _core, uint8 _consistencyLevel) public {
    vm.assume(_owner != address(0));

    WormholeDispatcher dispatcher = new WormholeDispatcher(_owner, _core, _consistencyLevel);
    assertEq(dispatcher.owner(), _owner);
    assertEq(address(dispatcher.wormholeCore()), _core);
    assertEq(dispatcher.consistencyLevel(), _consistencyLevel);
  }

  function testFuzz_RevertIf_OwnerIsZeroAddress(address _core, uint8 _consistencyLevel) public {
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new WormholeDispatcher(address(0), _core, _consistencyLevel);
  }
}

contract SetConsistencyLevel is WormholeDispatcherTest {
  function testFuzz_CorrectlySetConsistencyLevel(uint8 _consistencyLevel) public {
    vm.prank(owner);
    dispatcher.setConsistencyLevel(_consistencyLevel);
    assertEq(dispatcher.consistencyLevel(), _consistencyLevel);
  }

  function testFuzz_EmitsConsistencyLevelUpdatedEvent(uint8 _consistencyLevel) public {
    uint8 oldConsistencyLevel = dispatcher.consistencyLevel();

    vm.expectEmit();
    emit WormholeDispatcher.ConsistencyLevelUpdated(oldConsistencyLevel, _consistencyLevel);
    vm.prank(owner);
    dispatcher.setConsistencyLevel(_consistencyLevel);
  }

  function testFuzz_RevertIf_CallerIsNotOwner(address _caller, uint8 _consistencyLevel) public {
    vm.assume(_caller != owner);

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    dispatcher.setConsistencyLevel(_consistencyLevel);
  }
}

contract SetWormholeCore is WormholeDispatcherTest {
  function testFuzz_CorrectlySetWormholeCore(address _core) public {
    vm.prank(owner);
    dispatcher.setWormholeCore(_core);
    assertEq(address(dispatcher.wormholeCore()), _core);
  }

  function testFuzz_EmitsWormholeCoreUpdatedEvent(address _core) public {
    address oldCore = address(dispatcher.wormholeCore());

    vm.expectEmit();
    emit WormholeDispatcher.WormholeCoreUpdated(oldCore, _core);
    vm.prank(owner);
    dispatcher.setWormholeCore(_core);
  }

  function testFuzz_RevertIf_CallerIsNotOwner(address _caller, address _core) public {
    vm.assume(_caller != owner);

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    dispatcher.setWormholeCore(_core);
  }
}
