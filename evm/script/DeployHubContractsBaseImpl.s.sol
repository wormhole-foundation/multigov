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
import {HubEvmSpokeVoteDecoder} from "src/HubEvmSpokeVoteDecoder.sol";
import {HubSolanaMessageDispatcher} from "src/HubSolanaMessageDispatcher.sol";
import {HubSolanaSpokeVoteDecoder} from "src/HubSolanaSpokeVoteDecoder.sol";

abstract contract DeployHubContractsBaseImpl is Script {
  // This key should not be used for a production deploy. Instead, the `DEPLOYER_PRIVATE_KEY` environment variable
  // should be set.
  uint256 constant DEFAULT_DEPLOYER_PRIVATE_KEY =
    uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);

  string constant DEFAULT_DEPLOY_VERSION = "v1";

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
    bytes32 expectedProgramId;
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

  struct DeploymentParams {
    bytes32 salt;
    address timelockAddr;
    address wormholeCore;
    uint8 consistencyLevel;
    address govAddr;
  }

  error InvalidAddressConfiguration();

  function _getDeploymentConfiguration() internal virtual returns (DeploymentConfiguration memory);

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", DEFAULT_DEPLOYER_PRIVATE_KEY);

    Vm.Wallet memory wallet = vm.createWallet(deployerPrivateKey);
    if (deployerPrivateKey == DEFAULT_DEPLOYER_PRIVATE_KEY) revert InvalidAddressConfiguration();
    return wallet;
  }

  function run() public virtual returns (DeployedContracts memory) {
    DeploymentConfiguration memory config = _getDeploymentConfiguration();
    Vm.Wallet memory wallet = _deploymentWallet();
    vm.startBroadcast(wallet.privateKey);
    string memory version = vm.envOr("DEPLOY_VERSION", DEFAULT_DEPLOY_VERSION);
    bytes32 salt = keccak256(abi.encodePacked("WormholeGovernanceHubContracts", version, block.chainid));

    DeployedContracts memory contracts = _deployAllContracts(config, wallet, salt);

    _setupRolesAndOwnership(contracts.timelock, contracts.gov, contracts.extender, contracts.hubVotePool, wallet);

    vm.stopBroadcast();

    return contracts;
  }

  function _deployMainContracts(DeploymentConfiguration memory config, Vm.Wallet memory wallet, bytes32 salt)
    internal
    returns (
      TimelockController,
      HubProposalExtender,
      HubGovernor,
      HubProposalMetadata,
      HubMessageDispatcher,
      HubVotePool
    )
  {
    TimelockController timelock = _deployTimelock(config, wallet, salt);
    HubProposalExtender extender = _deployExtender(config, address(timelock), salt);
    HubGovernor gov = _deployGovernor(config, timelock, extender, wallet, salt);

    DeploymentParams memory params = DeploymentParams({
      salt: salt,
      timelockAddr: address(timelock),
      wormholeCore: config.wormholeCore,
      consistencyLevel: config.consistencyLevel,
      govAddr: address(gov)
    });

    (HubProposalMetadata hubProposalMetadata, HubMessageDispatcher hubMessageDispatcher) =
      _deployMetadataAndDispatcher(params);
    HubVotePool hubVotePool = gov.hubVotePool(uint96(block.timestamp));

    return (timelock, extender, gov, hubProposalMetadata, hubMessageDispatcher, hubVotePool);
  }

  function _deployTimelock(DeploymentConfiguration memory config, Vm.Wallet memory wallet, bytes32 salt)
    internal
    returns (TimelockController)
  {
    return new TimelockController{salt: salt}(config.minDelay, new address[](0), new address[](0), wallet.addr);
  }

  function _deployExtender(DeploymentConfiguration memory config, address timelockAddr, bytes32 salt)
    internal
    returns (HubProposalExtender)
  {
    return new HubProposalExtender{salt: salt}(
      config.voteExtenderAdmin, config.voteTimeExtension, timelockAddr, config.minimumExtensionTime
    );
  }

  function _deployGovernor(
    DeploymentConfiguration memory config,
    TimelockController timelock,
    HubProposalExtender extender,
    Vm.Wallet memory wallet,
    bytes32 salt
  ) internal returns (HubGovernor) {
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

    return new HubGovernor{salt: salt}(params);
  }

  function _deployMetadataAndDispatcher(DeploymentParams memory params)
    internal
    returns (HubProposalMetadata, HubMessageDispatcher)
  {
    HubProposalMetadata hubProposalMetadata = new HubProposalMetadata{salt: params.salt}(params.govAddr);
    HubMessageDispatcher hubMessageDispatcher =
      new HubMessageDispatcher{salt: params.salt}(params.timelockAddr, params.wormholeCore, params.consistencyLevel);
    return (hubProposalMetadata, hubMessageDispatcher);
  }

  function _setupRolesAndOwnership(
    TimelockController timelock,
    HubGovernor gov,
    HubProposalExtender extender,
    HubVotePool hubVotePool,
    Vm.Wallet memory wallet
  ) internal {
    hubVotePool.transferOwnership(address(timelock));
    extender.initialize(payable(gov));

    timelock.grantRole(timelock.PROPOSER_ROLE(), address(gov));
    timelock.grantRole(timelock.EXECUTOR_ROLE(), address(gov));
    timelock.grantRole(timelock.CANCELLER_ROLE(), address(gov));
    timelock.grantRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock));
    timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), wallet.addr);
  }

  function _deployAdditionalContracts(
    DeploymentConfiguration memory config,
    HubGovernor gov,
    HubVotePool hubVotePool,
    TimelockController timelock,
    bytes32 salt
  ) internal returns (HubEvmSpokeAggregateProposer, HubSolanaMessageDispatcher, HubSolanaSpokeVoteDecoder) {
    // Deploy HubEvmSpokeAggregateProposer using create2
    HubEvmSpokeAggregateProposer hubEvmSpokeAggregateProposer = new HubEvmSpokeAggregateProposer{salt: salt}(
      config.wormholeCore, address(gov), config.initialMaxQueryTimestampOffset
    );
    HubSolanaMessageDispatcher hubSolanaMessageDispatcher =
      new HubSolanaMessageDispatcher{salt: salt}(address(timelock), config.wormholeCore, config.consistencyLevel);

    HubSolanaSpokeVoteDecoder hubSolanaSpokeVoteDecoder = new HubSolanaSpokeVoteDecoder{salt: salt}(
      config.wormholeCore, address(hubVotePool), config.expectedProgramId, config.solanaTokenDecimals
    );

    return (hubEvmSpokeAggregateProposer, hubSolanaMessageDispatcher, hubSolanaSpokeVoteDecoder);
  }

  function _deployAllContracts(DeploymentConfiguration memory config, Vm.Wallet memory wallet, bytes32 salt)
    internal
    returns (DeployedContracts memory)
  {
    (
      TimelockController timelock,
      HubProposalExtender extender,
      HubGovernor gov,
      HubProposalMetadata hubProposalMetadata,
      HubMessageDispatcher hubMessageDispatcher,
      HubVotePool hubVotePool
    ) = _deployMainContracts(config, wallet, salt);

    (
      HubEvmSpokeAggregateProposer hubEvmSpokeAggregateProposer,
      HubSolanaMessageDispatcher hubSolanaMessageDispatcher,
      HubSolanaSpokeVoteDecoder hubSolanaSpokeVoteDecoder
    ) = _deployAdditionalContracts(config, gov, hubVotePool, timelock, salt);

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

  function predictDeployedAddresses(DeploymentConfiguration memory config, address deployer)
    public
    view
    returns (address[] memory)
  {
    bytes32 salt = keccak256(abi.encodePacked(config.name, block.chainid));

    address[] memory addresses = new address[](9);
    addresses[0] = computeCreate2Address(salt, keccak256(type(TimelockController).creationCode), deployer);
    addresses[1] = computeCreate2Address(salt, keccak256(type(HubProposalExtender).creationCode), deployer);
    addresses[2] = computeCreate2Address(salt, keccak256(type(HubGovernor).creationCode), deployer);
    addresses[3] = computeCreate2Address(salt, keccak256(type(HubProposalMetadata).creationCode), deployer);
    addresses[4] = computeCreate2Address(salt, keccak256(type(HubMessageDispatcher).creationCode), deployer);
    addresses[5] = computeCreate2Address(salt, keccak256(type(HubVotePool).creationCode), deployer);
    addresses[6] = computeCreate2Address(salt, keccak256(type(HubEvmSpokeAggregateProposer).creationCode), deployer);
    addresses[7] = computeCreate2Address(salt, keccak256(type(HubSolanaMessageDispatcher).creationCode), deployer);
    addresses[8] = computeCreate2Address(salt, keccak256(type(HubSolanaSpokeVoteDecoder).creationCode), deployer);

    return addresses;
  }
}
