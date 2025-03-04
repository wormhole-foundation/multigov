// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {HubVotePool} from "src/HubVotePool.sol";

contract RegisterSpokesOnHubTestnet is Script {
  address HUB_VOTE_POOL = 0xddEB0415Ada159AE53D980feB6FF05244F65FD7f; // TODO: Replace with the hub vote pool address
  address OPTIMISM_SEPOLIA_VOTE_AGGREGATOR = 0x767f74378aCAFDb44C7E2f73F49101aD2C3eD6d2; // TODO: Replace with a real
    // address
  bytes32 SOLANA_SPOKE = bytes32(0xabd58849f17e52708082849880f862589c11f972cb372d73b0cd219722cd0f22);
  address TIMELOCK = 0x1054f49899Af83e0c55375d54D2F57488cFC8606; // TODO Timelock address

  error InvalidAddressConfiguration();

  /// @notice Creates a wallet for deployment using the private key from environment
  /// @dev Requires DEPLOYER_PRIVATE_KEY to be set in the environment
  /// @return wallet The wallet to be used for deployment
  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
    return vm.createWallet(deployerPrivateKey);
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
