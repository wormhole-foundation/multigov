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
import {HubEvmSpokeAggregateProposer} from "src/HubEvmSpokeAggregateProposer.sol";
import {HubSolanaMessageDispatcher} from "src/HubSolanaMessageDispatcher.sol";
import {HubSolanaSpokeVoteDecoder} from "src/HubSolanaSpokeVoteDecoder.sol";

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
    uint48 initialMaxQueryTimestampOffset;
    uint8 solanaTokenDecimals;
  }

  struct DeployedContracts {
    TimelockController timelock;
    HubVotePool hubVotePool;
    HubGovernor gov;
    HubProposalMetadata hubProposalMetadata;
    HubMessageDispatcher hubMessageDispatcher;
    HubProposalExtender extender;
    HubEvmSpokeAggregateProposer hubEvmSpokeAggregateProposer;
    HubSolanaMessageDispatcher hubSolanaMessageDispatcher;
    HubSolanaSpokeVoteDecoder hubSolanaSpokeVoteDecoder;
  }

  error InvalidAddressConfiguration();

  function _getDeploymentConfiguration() internal virtual returns (DeploymentConfiguration memory);

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
    if (deployerPrivateKey == 0) revert InvalidAddressConfiguration();
    return vm.createWallet(deployerPrivateKey);
  }

  function run() public virtual returns (DeployedContracts memory) {
    DeploymentConfiguration memory config = _getDeploymentConfiguration();
    Vm.Wallet memory wallet = _deploymentWallet();
    vm.startBroadcast(wallet.privateKey);

    // Deploy timelock for governor.
    TimelockController timelock =
      new TimelockController(config.minDelay, new address[](0), new address[](0), wallet.addr);

    // Deploy proposal extender to be used in the HubGovernor.
    HubProposalExtender extender = new HubProposalExtender(
      config.voteExtenderAdmin, config.voteTimeExtension, address(timelock), wallet.addr, config.minimumExtensionTime
    );

    // Deploy `HubVotePool` which will revceive cross-chain votes.
    HubVotePool hubVotePool = new HubVotePool(config.wormholeCore, address(0), wallet.addr);

    HubGovernor.ConstructorParams memory hubGovernorParams = HubGovernor.ConstructorParams({
      name: config.name,
      token: ERC20Votes(config.token),
      timelock: timelock,
      initialVotingDelay: config.initialVotingDelay,
      initialVotingPeriod: config.initialVotingPeriod,
      initialProposalThreshold: config.initialProposalThreshold,
      initialQuorum: config.initialQuorum,
      hubVotePool: address(hubVotePool),
      wormholeCore: config.wormholeCore,
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: config.voteWeightWindow
    });

    // Deploy Wormhole governor
    HubGovernor gov = new HubGovernor(hubGovernorParams);

    // Set the governor on the `HubVotePool`
    hubVotePool.setGovernor(address(gov));

    // Deploy the vote decoder for Solana queries
    HubSolanaSpokeVoteDecoder hubSolanaSpokeVoteDecoder =
      new HubSolanaSpokeVoteDecoder(config.wormholeCore, address(hubVotePool), config.solanaTokenDecimals);

    // Register Solana vote decoder, 5 is the constant for QT_SOL_PDA.
    hubVotePool.registerQueryType(5, address(hubSolanaSpokeVoteDecoder));

    // Deploy hub metadata contract
    HubProposalMetadata hubProposalMetadata = new HubProposalMetadata(address(gov));

    // Deploy the Evm hub dispatcher
    HubMessageDispatcher hubMessageDispatcher =
      new HubMessageDispatcher(address(timelock), config.wormholeCore, config.consistencyLevel);

    // Deploy the Solana hub dispatcher
    HubSolanaMessageDispatcher hubSolanaMessageDispatcher =
      new HubSolanaMessageDispatcher(address(timelock), config.wormholeCore, config.consistencyLevel);

    // Deploy the evm aggregate proposer
    HubEvmSpokeAggregateProposer hubEvmSpokeAggregateProposer =
      new HubEvmSpokeAggregateProposer(config.wormholeCore, address(gov), config.initialMaxQueryTimestampOffset);
    extender.initialize(payable(gov));

    timelock.grantRole(timelock.PROPOSER_ROLE(), address(gov));
    timelock.grantRole(timelock.EXECUTOR_ROLE(), address(gov));
    timelock.grantRole(timelock.CANCELLER_ROLE(), address(gov));
    timelock.grantRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock));
    timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), wallet.addr);

    vm.stopBroadcast();

    return DeployedContracts({
      timelock: timelock,
      extender: extender,
      gov: gov,
      hubProposalMetadata: hubProposalMetadata,
      hubMessageDispatcher: hubMessageDispatcher,
      hubVotePool: hubVotePool,
      hubEvmSpokeAggregateProposer: hubEvmSpokeAggregateProposer,
      hubSolanaMessageDispatcher: hubSolanaMessageDispatcher,
      hubSolanaSpokeVoteDecoder: hubSolanaSpokeVoteDecoder
    });
  }
}
