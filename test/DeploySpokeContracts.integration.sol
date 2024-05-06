// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {TestConstants} from "test/TestConstants.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
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
    SpokeVoteAggregator aggregator = script.run();
    assertEq(address(aggregator.WORMHOLE_CORE()), 0x31377888146f3253211EFEf5c676D41ECe7D58Fe);
    assertEq(aggregator.HUB_CHAIN_ID(), 10_002);
    assertEq(aggregator.HUB_PROPOSAL_METADATA(), 0xe139982C9f0810C110a386eAd2A153217eCcB9D6);
    assertEq(address(aggregator.VOTING_TOKEN()), 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4);
    assertEq(aggregator.safeWindow(), 180);
    assertEq(aggregator.owner(), deployer);
  }
}
