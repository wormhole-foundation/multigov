// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

import {HubGovernor} from "src/HubGovernor.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";

abstract contract DeployHubContractsBaseImpl is Script {
  // This key should not be used for a production deploy. Instead, the `DEPLOYER_PRIVATE_KEY` environment variable
  // should be set.
  uint256 constant DEFAULT_DEPLOYER_PRIVATE_KEY =
    uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);

  struct DeploymentConfiguration {
    uint256 minDelay;
    string name;
    address token;
    uint48 initialVotingDelay;
    uint32 initialVotingPeriod;
    uint256 initialProposalThreshold;
    uint208 initialQuorum;
    address wormholeCore;
  }

  error InvalidAddressConfiguration();

  function _getDeploymentConfiguration() internal pure virtual returns (DeploymentConfiguration memory);

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", DEFAULT_DEPLOYER_PRIVATE_KEY);

    Vm.Wallet memory wallet = vm.createWallet(deployerPrivateKey);
    if (deployerPrivateKey == DEFAULT_DEPLOYER_PRIVATE_KEY) revert InvalidAddressConfiguration();
    return wallet;
  }

  function run() public returns (TimelockController, HubVotePool, HubGovernor, HubProposalMetadata) {
    DeploymentConfiguration memory config = _getDeploymentConfiguration();
    Vm.Wallet memory wallet = _deploymentWallet();
    vm.startBroadcast(wallet.privateKey);
    TimelockController timelock =
      new TimelockController(config.minDelay, new address[](0), new address[](0), wallet.addr);

    HubVotePool pool = new HubVotePool(config.wormholeCore, wallet.addr, new HubVotePool.SpokeVoteAggregator[](0));

    // DeployHub Governor
    HubGovernor gov = new HubGovernor(
      config.name,
      IVotes(config.token),
      timelock,
      config.initialVotingDelay,
      config.initialVotingPeriod,
      config.initialProposalThreshold,
      config.initialQuorum,
      address(pool)
    );

    // Ownership will be transferred during configuration
    pool.setGovernor(address(gov));

    // Grant roles
    timelock.grantRole(timelock.PROPOSER_ROLE(), address(gov));
    timelock.grantRole(timelock.EXECUTOR_ROLE(), address(gov));
    timelock.grantRole(timelock.CANCELLER_ROLE(), address(gov));
    timelock.grantRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock));
    timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), wallet.addr);

    HubProposalMetadata proposalMetadata = new HubProposalMetadata(address(gov));
    vm.stopBroadcast();

    return (timelock, pool, gov, proposalMetadata);
  }
}
