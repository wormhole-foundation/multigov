// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {DeployHubContractsSepolia} from "script/DeployHubContractsSepolia.sol";
import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";
import {TestConstants} from "test/TestConstants.sol";

contract DeployHubContractsBase is Test, TestConstants {
  address deployer;
  uint256 deployerKey;

  function setUp() public {
    (deployer, deployerKey) = makeAddrAndKey("deployer");
    vm.setEnv("DEPLOYER_PRIVATE_KEY", vm.toString(deployerKey));
  }
}

contract DeployHubContractsTest is DeployHubContractsBase {
  function testFork_deploySepoliaHubContracts() public {
    vm.createSelectFork(vm.rpcUrl("sepolia"), 5_718_968);

    DeployHubContractsSepolia script = new DeployHubContractsSepolia();
    DeployHubContractsBaseImpl.DeployedContracts memory contracts = script.run();

    TimelockController timelock = contracts.timelock;
    HubGovernor governor = contracts.gov;
    HubVotePool hubVotePool = contracts.hubVotePool;
    HubProposalMetadata proposalMetadata = contracts.hubProposalMetadata;
    HubMessageDispatcher dispatcher = contracts.hubMessageDispatcher;
    HubProposalExtender extender = contracts.extender;

    assertEq(timelock.getMinDelay(), 300);
    assertEq(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(governor)), true);
    assertEq(timelock.hasRole(timelock.PROPOSER_ROLE(), address(governor)), true);
    assertEq(timelock.hasRole(timelock.CANCELLER_ROLE(), address(governor)), true);

    assertEq(address(governor.token()), WORMHOLE_SEPOLIA_W_TOKEN);
    assertEq(governor.votingDelay(), 90);
    assertEq(governor.votingPeriod(), 1800);
    assertEq(governor.proposalThreshold(), 500_000e18);
    assertEq(governor.quorum(block.timestamp), 1_000_000e18);
    assertEq(governor.name(), "Wormhole Sepolia Governor");
    assertEq(address(governor.HUB_PROPOSAL_EXTENDER()), address(extender));
    assertEq(governor.getVoteWeightWindowLength(uint48(block.timestamp)), 10 minutes);
    assertEq(governor.whitelistedProposer(), address(0));

    assertEq(address(hubVotePool.wormhole()), 0x31377888146f3253211EFEf5c676D41ECe7D58Fe);
    assertEq(address(hubVotePool.owner()), address(timelock));
    assertEq(address(hubVotePool.hubGovernor()), address(governor));

    assertEq(address(proposalMetadata.GOVERNOR()), address(governor));

    assertEq(extender.voteExtenderAdmin(), address(deployer));
    assertEq(extender.extensionDuration(), 5 minutes);
    assertEq(extender.MINIMUM_EXTENSION_DURATION(), 1 minutes);
    assertEq(address(extender.governor()), address(governor));
    assertEq(extender.initialized(), true);

    assertEq(dispatcher.owner(), address(timelock));
    assertEq(address(dispatcher.wormholeCore()), 0x31377888146f3253211EFEf5c676D41ECe7D58Fe);
    assertEq(dispatcher.consistencyLevel(), 0);
  }
}
