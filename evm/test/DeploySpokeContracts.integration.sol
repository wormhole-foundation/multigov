// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {TestConstants} from "test/TestConstants.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {DeploySpokeContractsOptimismSepolia} from "script/DeploySpokeContractsOptimismSepolia.sol";

contract DeploySpokeContractsBase is Test, TestConstants {
  address deployer;
  uint256 deployerKey;

  function setUp() public {
    (deployer, deployerKey) = makeAddrAndKey("deployer");
    vm.setEnv("DEPLOYER_PRIVATE_KEY", vm.toString(deployerKey));
  }
}

contract DeploySpokeContractsTest is DeploySpokeContractsBase {
  function testFork_deploySepoliaHubContracts() public {
    vm.createSelectFork(vm.rpcUrl("optimism_sepolia"), 11_298_960);

    DeploySpokeContractsOptimismSepolia script = new DeploySpokeContractsOptimismSepolia();
    (
      SpokeVoteAggregator aggregator,
      SpokeMetadataCollector spokeMetadataCollector,
      SpokeMessageExecutor messageExecutor,
      SpokeAirlock airlock
    ) = script.run();

    assertEq(spokeMetadataCollector.HUB_CHAIN_ID(), 10_002);
    assertEq(spokeMetadataCollector.HUB_PROPOSAL_METADATA(), 0x336Ac4C729F5E3696508460B40c12B065D86E612);

    assertEq(address(aggregator.VOTING_TOKEN()), 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4);
    assertEq(address(aggregator.spokeMetadataCollector()), address(spokeMetadataCollector));
    assertEq(aggregator.owner(), deployer);
    assertEq(aggregator.getVoteWeightWindowLength(uint48(block.timestamp)), 10 minutes);

    assertEq(messageExecutor.hubChainId(), 10_002);
    assertEq(address(messageExecutor.wormholeCore()), 0x31377888146f3253211EFEf5c676D41ECe7D58Fe);
    assertEq(messageExecutor.spokeChainId(), 10_005);
    assertEq(airlock.MESSAGE_EXECUTOR(), address(messageExecutor));
  }
}
