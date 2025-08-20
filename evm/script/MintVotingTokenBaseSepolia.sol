// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract MintVotingTokenBaseSepolia is Script {
  function run(address recipient) public {
    uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
    address token = 0x12Fb7f85dea3A3F83018E4A647dC8B0456dF9B39;
    uint208 amount = uint208(10_000_000 * 10 ** 18); // 10M tokens

    vm.startBroadcast(deployerPrivateKey);

    ERC20Mock(token).mint(recipient, amount);

    vm.stopBroadcast();
  }
}
