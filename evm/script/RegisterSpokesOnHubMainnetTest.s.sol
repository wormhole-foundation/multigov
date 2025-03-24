// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {HubVotePool} from "src/HubVotePool.sol";

contract RegisterSpokesOnHubMainnetTest is Script {
  address HUB_VOTE_POOL = 0x6D87469dC04aec896dB03Df9B1b9Ba29535CC206; // TODO: Replace with the hub vote pool address
  address OPTIMISM_VOTE_AGGREGATOR = 0x75F755950D59d2007A0C90457fDc190732567cC5; // TODO: Replace with a real
  address BASE_VOTE_AGGREGATOR = 0x31eD7EAa0CCA7e95a93339843a1C257b87e31E3d; // TODO: Replace with a real
  address ARBITRUM_VOTE_AGGREGATOR = 0x6dEfA659A9726925307a45B30Ffe2Da45ED90811; // TODO: Replace with a real

    // address
  bytes32 SOLANA_SPOKE = bytes32(0xee7066afc36b670f4b52088b82a96da0ba563335db5ac099786d9f8800ff429e);
  address TIMELOCK = 0x0fAA8fc7A60809B3557d5Dbe463B64F94de5ac06; // TODO Timelock address

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
    //hubVotePool.transferOwnership(TIMELOCK);
    vm.stopBroadcast();
  }
}
