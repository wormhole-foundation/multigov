// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";

abstract contract DeploySpokeContractsBaseImpl is Script {
  // This should not be used for a production deploy the correct address will be set as an environment variable.
  uint256 constant DEFAULT_DEPLOYER_PRIVATE_KEY =
    uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);

  string constant DEFAULT_DEPLOY_VERSION = "v2";

  struct DeploymentConfiguration {
    address wormholeCore;
    uint16 hubChainId;
    address hubProposalMetadata;
    address votingToken;
    uint48 voteWeightWindow;
    bytes32 hubDispatcher;
    uint16 spokeChainId;
  }

  struct DeployedContracts {
    SpokeVoteAggregator aggregator;
    SpokeMetadataCollector metadataCollector;
    SpokeMessageExecutor executor;
    SpokeAirlock airlock;
  }

  error InvalidAddressConfiguration();

  function _getDeploymentConfiguration() internal pure virtual returns (DeploymentConfiguration memory);

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", DEFAULT_DEPLOYER_PRIVATE_KEY);

    Vm.Wallet memory wallet = vm.createWallet(deployerPrivateKey);
    Vm.Wallet memory defaultWallet = vm.createWallet(DEFAULT_DEPLOYER_PRIVATE_KEY);
    if (defaultWallet.addr == wallet.addr) revert InvalidAddressConfiguration();
    return wallet;
  }

  function run() public returns (DeployedContracts memory) {
    DeploymentConfiguration memory config = _getDeploymentConfiguration();
    Vm.Wallet memory wallet = _deploymentWallet();
    string memory version = vm.envOr("DEPLOY_VERSION", DEFAULT_DEPLOY_VERSION);
    bytes32 salt = keccak256(abi.encodePacked("WormholeGovernanceSpokeContracts", version, config.hubChainId));

    vm.startBroadcast(wallet.privateKey);

    // Deploy implementation
    SpokeMessageExecutor impl = new SpokeMessageExecutor{salt: salt}(wallet.addr);

    // Deploy executor proxy
    ERC1967Proxy proxy = new ERC1967Proxy{salt: salt}(address(impl), "");

    SpokeMessageExecutor executor = SpokeMessageExecutor(address(proxy));

    // Initialize executor
    executor.initialize(config.hubDispatcher, config.hubChainId, config.wormholeCore);

    // Assign deployed airlock
    SpokeAirlock airlock = executor.airlock();

    // Deploy spoke metadata collector
    SpokeMetadataCollector spokeMetadataCollector =
      new SpokeMetadataCollector{salt: salt}(config.wormholeCore, config.hubChainId, config.hubProposalMetadata);

    // Deploy vote aggregator
    SpokeVoteAggregator voteAggregator = new SpokeVoteAggregator{salt: salt}(
      address(spokeMetadataCollector), config.votingToken, address(airlock), config.voteWeightWindow
    );

    vm.stopBroadcast();

    return DeployedContracts({
      aggregator: voteAggregator,
      metadataCollector: spokeMetadataCollector,
      executor: executor,
      airlock: airlock
    });
  }
}
