// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {HubVotePool} from "src/HubVotePool.sol";

contract RegisterSpokesOnHubMainnet is Script {
  address HUB_VOTE_POOL = 0x2E57935d31Ef7F161e7bC69Fca873E04097ff3af;
  address OPTIMISM_VOTE_AGGREGATOR = 0x0A447C68166B486E84a87B869018c040063A1f16;
  address BASE_VOTE_AGGREGATOR = 0x4C31eeEe22c08474A45e15Bb23c46A6f2b446FB4;
  address ARBITRUM_VOTE_AGGREGATOR = 0xe495E8632D2C335969F7CE1Ee1c6F4618ce0D780;

  // address
  bytes32 SOLANA_SPOKE = bytes32(0x05317ba34782df7acc92a59ac742832576b42ba18a8d07b5f31de087a3dd800a);
  address TIMELOCK = 0xfBc580c0289121673EfB7375fF111bD2A4db4654; // TODO Timelock address

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
    hubVotePool.registerSpoke(24, bytes32(uint256(uint160(OPTIMISM_VOTE_AGGREGATOR))));
    hubVotePool.registerSpoke(23, bytes32(uint256(uint160(ARBITRUM_VOTE_AGGREGATOR))));
    hubVotePool.registerSpoke(30, bytes32(uint256(uint160(BASE_VOTE_AGGREGATOR))));
    // transfer owner
    hubVotePool.transferOwnership(TIMELOCK);
    vm.stopBroadcast();
  }
}
