// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Script, stdJson} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

import {HubCrossChainEvmCallVoteDecoder} from "src/HubCrossChainEvmCallVoteDecoder.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubGovernorProposalExtender} from "src/HubGovernorProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";

contract MakeProposal is Script {
  // This key should not be used for a production deploy. Instead, the `DEPLOYER_PRIVATE_KEY` environment variable
  // should be set.
  uint256 constant DEFAULT_DEPLOYER_PRIVATE_KEY =
    uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
  address[] addresses;
  uint[] values;
  bytes[] calldatas;

  function _deploymentWallet() internal virtual returns (Vm.Wallet memory) {
    uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", DEFAULT_DEPLOYER_PRIVATE_KEY);

    Vm.Wallet memory wallet = vm.createWallet(deployerPrivateKey);
    return wallet;
  }

  function run()
    public
  {
	// create proposal
	addresses.push(0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4);
	values.push(0);
	calldatas.push(abi.encodeWithSignature("balanceOf(address)", 0xEAC5F0d4A9a45E1f9FdD0e7e2882e9f60E301156));
	console2.logBytes(abi.encode(10005, addresses, values, calldatas));

  }
}
