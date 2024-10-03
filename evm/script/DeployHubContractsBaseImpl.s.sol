// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

import {HubGovernor} from "src/HubGovernor.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";

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
    uint48 voteWeightWindow;
    address voteExtenderAdmin;
    uint48 voteTimeExtension;
    uint48 minimumExtensionTime;
    uint8 consistencyLevel;
  }

  error InvalidAddressConfiguration();

  function _getDeploymentConfiguration() internal virtual returns (DeploymentConfiguration memory);

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", DEFAULT_DEPLOYER_PRIVATE_KEY);

    Vm.Wallet memory wallet = vm.createWallet(deployerPrivateKey);
    if (deployerPrivateKey == DEFAULT_DEPLOYER_PRIVATE_KEY) revert InvalidAddressConfiguration();
    return wallet;
  }

  function run()
    public
    returns (
      TimelockController,
      HubVotePool,
      HubGovernor,
      HubProposalMetadata,
      HubMessageDispatcher,
      HubProposalExtender
    )
  {
    DeploymentConfiguration memory config = _getDeploymentConfiguration();
    Vm.Wallet memory wallet = _deploymentWallet();
    vm.startBroadcast(wallet.privateKey);
    TimelockController timelock =
      new TimelockController(config.minDelay, new address[](0), new address[](0), wallet.addr);

    HubProposalExtender extender = new HubProposalExtender(
      config.voteExtenderAdmin, config.voteTimeExtension, address(timelock), config.minimumExtensionTime
    );

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: config.name,
      token: ERC20Votes(config.token),
      timelock: timelock,
      initialVotingDelay: config.initialVotingDelay,
      initialVotingPeriod: config.initialVotingPeriod,
      initialProposalThreshold: config.initialProposalThreshold,
      initialQuorum: config.initialQuorum,
      hubVotePoolOwner: wallet.addr,
      wormholeCore: config.wormholeCore,
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: config.voteWeightWindow
    });

    // Deploy Hub Governor
    HubGovernor gov = new HubGovernor(params);

    // Deploy HubProposalMetadata
    HubProposalMetadata hubProposalMetadata = new HubProposalMetadata(address(gov));

    // Deploy Hub Discptacher
    HubMessageDispatcher hubMessageDispatcher =
      new HubMessageDispatcher(address(timelock), config.wormholeCore, config.consistencyLevel);

    HubVotePool hubVotePool = gov.hubVotePool(uint96(block.timestamp));

    // The timelock should be the owner of the hub vote pool
    hubVotePool.transferOwnership(address(timelock));

    // Set governor on extender
    extender.initialize(payable(gov));

    // Grant roles
    timelock.grantRole(timelock.PROPOSER_ROLE(), address(gov));
    timelock.grantRole(timelock.EXECUTOR_ROLE(), address(gov));
    timelock.grantRole(timelock.CANCELLER_ROLE(), address(gov));
    timelock.grantRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock));
    timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), wallet.addr);

    vm.stopBroadcast();

    return (timelock, hubVotePool, gov, hubProposalMetadata, hubMessageDispatcher, extender);
  }
}
