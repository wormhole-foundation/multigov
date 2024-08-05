// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

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

contract CreateProposal is Script {
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
    Vm.Wallet memory wallet = _deploymentWallet();
    vm.startBroadcast(wallet.privateKey);
	// create proposal
	addresses.push(0xfa9eBF6eC7A06aeb40fd32e7d7b2146b328C19e1);
	values.push(0);
	calldatas.push(abi.encodeWithSignature("dispatch(bytes)", hex"ad885490b5941f6af5e5ff776af88e5f2ae07f0fce898e0b98b404b1cd496dea000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000100000000000000000000000074f00907cfc6e44fb72535cdd1ec52a37eacabe40000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000eac5f0d4a9a45e1f9fdd0e7e2882e9f60e30115600000000000000000000000000000000000000000000000000000000"));
	string memory desc = "Test 1";
	HubGovernor(payable(0x69cBB9a59072663625a6E3EB3aeE31E435213F7b)).propose(addresses, values, calldatas, desc);
    vm.stopBroadcast();

  }
}
