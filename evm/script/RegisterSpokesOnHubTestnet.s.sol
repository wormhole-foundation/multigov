// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {HubVotePool} from "src/HubVotePool.sol";

contract RegisterSpokesOnHubTestnet is Script {
  address HUB_VOTE_POOL = address(0); // TODO: Replace with the hub vote pool address
  address OPTIMISM_SEPOLIA_VOTE_AGGREGATOR = address(0); // TODO: Replace with a real address
  bytes32 SOLANA_SPOKE = bytes32(0xabd58849f17e52708082849880f862589c11f972cb372d73b0cd219722cd0f22);
  address TIMELOCK = address(0); // TODO Timelock address

  // This key should not be used for a production deploy. Instead, the `DEPLOYER_PRIVATE_KEY` environment variable
  // should be set.
  uint256 constant DEFAULT_DEPLOYER_PRIVATE_KEY =
    uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);

  error InvalidAddressConfiguration();

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", DEFAULT_DEPLOYER_PRIVATE_KEY);

    Vm.Wallet memory wallet = vm.createWallet(deployerPrivateKey);
    if (deployerPrivateKey == DEFAULT_DEPLOYER_PRIVATE_KEY) revert InvalidAddressConfiguration();
    return wallet;
  }

  function run() public virtual {
    Vm.Wallet memory wallet = _deploymentWallet();

    vm.startBroadcast(wallet.privateKey);
    HubVotePool hubVotePool = HubVotePool(HUB_VOTE_POOL);
    // register solana
    hubVotePool.registerSpoke(1, SOLANA_SPOKE);
    hubVotePool.registerSpoke(10_005, bytes32(uint256(uint160(OPTIMISM_SEPOLIA_VOTE_AGGREGATOR))));
    // transfer owenr
    hubVotePool.transferOwnership(TIMELOCK);
    vm.stopBroadcast();
  }
}
