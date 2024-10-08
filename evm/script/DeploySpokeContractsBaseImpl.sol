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
    bytes32 salt = keccak256(abi.encodePacked("WormholeGovernanceSpokeContracts", "v1", config.hubChainId));

    vm.startBroadcast(wallet.privateKey);

    DeployedContracts memory contracts;

    contracts.executor = _deploySpokeMessageExecutor(config, wallet, salt);
    contracts.airlock = contracts.executor.airlock();
    contracts.metadataCollector = _deploySpokeMetadataCollector(config, salt);
    contracts.aggregator = _deploySpokeVoteAggregator(config, contracts.metadataCollector, contracts.airlock, salt);

    vm.stopBroadcast();

    return contracts;
  }

  function _deploySpokeMessageExecutor(DeploymentConfiguration memory config, Vm.Wallet memory wallet, bytes32 salt)
    internal
    returns (SpokeMessageExecutor)
  {
    SpokeMessageExecutor impl = new SpokeMessageExecutor{salt: salt}(wallet.addr);
    ERC1967Proxy proxy = new ERC1967Proxy{salt: salt}(
      address(impl),
      abi.encodeCall(SpokeMessageExecutor.initialize, (config.hubDispatcher, config.hubChainId, config.wormholeCore))
    );
    return SpokeMessageExecutor(address(proxy));
  }

  function _deploySpokeMetadataCollector(DeploymentConfiguration memory config, bytes32 salt)
    internal
    returns (SpokeMetadataCollector)
  {
    return new SpokeMetadataCollector{salt: salt}(config.wormholeCore, config.hubChainId, config.hubProposalMetadata);
  }

  function _deploySpokeVoteAggregator(
    DeploymentConfiguration memory config,
    SpokeMetadataCollector metadataCollector,
    SpokeAirlock airlock,
    bytes32 salt
  ) internal returns (SpokeVoteAggregator) {
    return new SpokeVoteAggregator{salt: salt}(
      address(metadataCollector), config.votingToken, address(airlock), config.voteWeightWindow
    );
  }

  function predictDeployedAddresses(address deployer, bytes32 salt) public pure returns (address[] memory) {
    address[] memory addresses = new address[](4);
    addresses[0] = computeCreate2Address(salt, keccak256(type(SpokeMessageExecutor).creationCode), deployer);
    addresses[1] = computeCreate2Address(salt, keccak256(type(ERC1967Proxy).creationCode), deployer); // For
      // SpokeMessageExecutor proxy
    addresses[2] = computeCreate2Address(salt, keccak256(type(SpokeMetadataCollector).creationCode), deployer);
    addresses[3] = computeCreate2Address(salt, keccak256(type(SpokeVoteAggregator).creationCode), deployer);

    return addresses;
  }
}
