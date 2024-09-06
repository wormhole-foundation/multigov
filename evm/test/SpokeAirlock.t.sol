// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {SlotUpdate} from "test/helpers/SlotUpdate.sol";
import {WormholeCoreMock} from "test/mocks/WormholeCoreMock.sol";

contract SpokeAirlockTest is Test {
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

  function _createPerformDelegateCallProposal(address _target, bytes memory _calldata) public returns (ProposalBuilder) {
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(airlock), 0, abi.encodeWithSignature("performDelegateCall(address,bytes)", _target, _calldata));
    return builder;
  }
}

contract Constructor is SpokeAirlockTest {
  function testFuzz_CorrectlySetConstructorArgs(address _executor) public {
    SpokeAirlock airlock = new SpokeAirlock(_executor);
    assertEq(airlock.MESSAGE_EXECUTOR(), _executor);
  }
}

contract Receive is SpokeAirlockTest {
  function testFuzz_AirlockCanReceiveEther(uint256 _amount) public {
    address sender = makeAddr("Ether sender");
    vm.deal(sender, _amount);
    vm.prank(sender);
    payable(airlock).transfer(_amount);
    assertEq(address(airlock).balance, _amount);
  }
}

contract ExecuteOperations is SpokeAirlockTest {
  function testFuzz_ExecuteASingleProposal(address _account, uint208 _amount) public {
    vm.assume(_account != address(0));
    ProposalBuilder builder = _createMintProposal(_account, _amount);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    vm.prank(address(executor));
    airlock.executeOperations(targets, values, calldatas);
    assertEq(token.balanceOf(_account), _amount);
  }

  function testFuzz_RevertIf_NotCalledByMessageExecutor(address _account, uint208 _amount, address _caller) public {
    vm.assume(_account != address(0));
    vm.assume(_caller != address(executor));
    ProposalBuilder builder = _createMintProposal(_account, _amount);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(_caller);
    vm.expectRevert(SpokeAirlock.InvalidMessageExecutor.selector);
    airlock.executeOperations(targets, values, calldatas);
  }
}

contract PerformDelegateCall is SpokeAirlockTest {
  function testFuzz_ExecuteASingleProposal(address _account, uint208 _amount) public {
    vm.assume(_account != address(0));
    ProposalBuilder builder = _createPerformDelegateCallProposal(
      address(token), abi.encodeWithSignature("mint(address,uint208)", _account, _amount)
    );
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    vm.prank(address(executor));
    airlock.executeOperations(targets, values, calldatas);
    assertEq(token.balanceOf(_account), 0);
    // Check the storage slot where we expect totalSupply to be.
    assertEq(uint256(vm.load(address(airlock), bytes32(uint256(2)))), _amount);
  }

  function testFuzz_RevertIf_IfCallerIsNotTheSpokeAirlock(address _caller, address _target, bytes memory _calldata)
    public
  {
    vm.assume(_target != address(0));
    vm.assume(_caller != address(airlock));

    vm.prank(_caller);
    vm.expectRevert(SpokeAirlock.InvalidCaller.selector);
    airlock.performDelegateCall(_target, _calldata);
  }
}
