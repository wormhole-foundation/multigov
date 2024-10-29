// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {HubVotePool} from "src/HubVotePool.sol";

contract RegisterSpokesOnHubTestnet is Script {
  address HUB_VOTE_POOL = 0x4eE552355D4720a4DcE7FF022eB7490575f50567; // TODO: Replace with the hub vote pool address
  address OPTIMISM_SEPOLIA_VOTE_AGGREGATOR = 0x1Ae4d4189dEeC449850e4008E47A5B7a16052D4b; // TODO: Replace with a real
    // address
  bytes32 SOLANA_SPOKE = bytes32(0x751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d45);
  address TIMELOCK = 0xB95318e35cAc940A2fD7E4a93b8323fb393cC5d2; // TODO Timelock address

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
    // transfer owner
    //hubVotePool.transferOwnership(TIMELOCK);
    vm.stopBroadcast();
  }
}
