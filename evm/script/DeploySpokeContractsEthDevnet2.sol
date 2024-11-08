// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {toWormholeFormat} from "wormhole-sdk/Utils.sol";
import {DeploySpokeContractsBaseImpl} from "./DeploySpokeContractsBaseImpl.sol";
import {ERC20VotesFake} from "../test/fakes/ERC20VotesFake.sol";


/// @notice Deploy the spoke contracts for EthDevnet2 when using the Wormhole Tilt testing environment (Devnet).
/// @dev Set the environment variable DEPLOYER_PRIVATE_KEY to the private key of the account that will be used to deploy
/// the
/// contracts.
/// @dev Deploy with:
/// forge script script/DeploySpokeContractsEthDevnet2.sol:DeploySpokeContractsEthDevnet2 --rpc-url
/// http://localhost:8546 --broadcast --via-ir
contract DeploySpokeContractsEthDevnet2 is DeploySpokeContractsBaseImpl {
contract DeploySpokeContractsEthDevnet2 is DeploySpokeContractsBaseImpl {
  error ContractNotFound(string contractName);

  function _findContractAddress(string memory json, string memory contractName) internal view returns (address) {
    // First get the transactions array from the broadcast object
    bytes[] memory txs = abi.decode(vm.parseJson(json, "$.transactions"), (bytes[]));
    uint256 length = txs.length;

    for (uint256 i = 0; i < length; i++) {
      string memory namePath = string.concat("$.transactions[", vm.toString(i), "].contractName");
      string memory currentName = vm.parseJsonString(json, namePath);

      if (keccak256(bytes(currentName)) == keccak256(bytes(contractName))) {
        string memory addrPath = string.concat("$.transactions[", vm.toString(i), "].contractAddress");
        bytes memory addrBytes = vm.parseJson(json, addrPath);
        return abi.decode(addrBytes, (address));
      }
    }

    revert ContractNotFound(contractName);
  }

  function _getDeploymentConfiguration() internal override returns (DeploymentConfiguration memory) {
    Vm.Wallet memory wallet = _deploymentWallet();

    vm.startBroadcast(wallet.privateKey);

    // Deploy ERC20VotesFake using CREATE2
    string memory version = vm.envOr("DEPLOY_VERSION", DEFAULT_DEPLOY_VERSION);
    bytes32 salt = keccak256(abi.encodePacked("WormholeGovernanceHubContracts", version));
    bytes memory bytecode =
      abi.encodePacked(type(ERC20VotesFake).creationCode, abi.encode("MultiGov Governance Token", "MGT", 18));
    address tokenAddress = Create2.deploy(0, salt, bytecode);
    ERC20VotesFake token = ERC20VotesFake(tokenAddress);

    uint256 initialSupply = 1_000_000_000e18; // 1 billion tokens
    token.mint(wallet.addr, initialSupply);
    vm.stopBroadcast();

    // Read the latest hub deployment to get the addresses
    string memory root = vm.projectRoot();
    string memory path = string.concat(root, "/broadcast/DeployHubContractsEthDevnet1.sol/1337/run-latest.json");
    string memory json = vm.readFile(path);

    address hubProposalMetadata = _findContractAddress(json, "HubProposalMetadata");
    address hubDispatcher = _findContractAddress(json, "HubMessageDispatcher");

    return DeploymentConfiguration({
      wormholeCore: 0xC89Ce4735882C9F0f0FE26686c53074E09B0D550, // EthDevnet2 Wormhole Core
      hubChainId: 2, // EthDevnet1 Wormhole chain ID
      hubProposalMetadata: hubProposalMetadata,
      votingToken: address(token),
      voteWeightWindow: 10 minutes,
      hubDispatcher: toWormholeFormat(hubDispatcher),
      spokeChainId: 4 // EthDevnet2 Wormhole chain ID
    });
  }
}
