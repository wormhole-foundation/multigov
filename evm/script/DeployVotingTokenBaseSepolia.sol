// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

contract DeployVotingTokenBaseSepolia is Script {
  function run() public returns (address) {
    uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

    vm.startBroadcast(deployerPrivateKey);

    ERC20VotesFake token = new ERC20VotesFake();

    vm.stopBroadcast();

    return address(token);
  }
}
