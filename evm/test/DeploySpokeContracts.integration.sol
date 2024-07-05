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

    assertEq(address(spokeMetadataCollector.WORMHOLE_CORE()), 0x31377888146f3253211EFEf5c676D41ECe7D58Fe);
    assertEq(spokeMetadataCollector.HUB_CHAIN_ID(), 10_002);
    assertEq(spokeMetadataCollector.HUB_PROPOSAL_METADATA(), 0xe139982C9f0810C110a386eAd2A153217eCcB9D6);

    assertEq(address(aggregator.VOTING_TOKEN()), 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4);
    assertEq(address(aggregator.spokeMetadataCollector()), address(spokeMetadataCollector));
    assertEq(aggregator.owner(), deployer);
    assertEq(aggregator.getVoteWeightWindowLength(uint48(block.timestamp)), 10 minutes);

    // Need to deploy first
    //assertEq(messageExecutor.HUB_DISPATCHER(), );
    assertEq(messageExecutor.HUB_CHAIN_ID(), 10_002);
    assertEq(address(messageExecutor.WORMHOLE_CORE()), 0x31377888146f3253211EFEf5c676D41ECe7D58Fe);
    assertEq(messageExecutor.SPOKE_CHAIN_ID(), 10_005);
    assertEq(messageExecutor.initialized(), true);

    assertEq(airlock.messageExecutor(), address(messageExecutor));
  }
}
