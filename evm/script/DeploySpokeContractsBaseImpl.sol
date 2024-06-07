// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";

abstract contract DeploySpokeContractsBaseImpl is Script {
  // This should not be used for a production deploy the correct address will be set as an environment variable.
  uint256 constant DEFAULT_DEPLOYER_PRIVATE_KEY =
    uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);

  struct DeploymentConfiguration {
    address wormholeCore;
    uint16 hubChainId;
    address hubProposalMetadata;
    address votingToken;
    uint32 safeWindow;
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

  function run() public returns (SpokeVoteAggregator, SpokeMetadataCollector) {
    DeploymentConfiguration memory config = _getDeploymentConfiguration();
    Vm.Wallet memory wallet = _deploymentWallet();
    vm.startBroadcast(wallet.privateKey);
    SpokeMetadataCollector spokeMetadataCollector =
      new SpokeMetadataCollector(config.wormholeCore, config.hubChainId, config.hubProposalMetadata);
    SpokeVoteAggregator aggregator =
      new SpokeVoteAggregator(address(spokeMetadataCollector), config.votingToken, config.safeWindow, wallet.addr);

    vm.stopBroadcast();
    return (aggregator, spokeMetadataCollector);
  }
}
