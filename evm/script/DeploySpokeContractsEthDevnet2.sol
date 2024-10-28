// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {toWormholeFormat} from "wormhole-sdk/Utils.sol";
import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

/**
 * @notice Deploy the spoke contracts for EthDevnet2 when using the Wormhole Tilt testing environment (Devnet).
 * @dev Set the environment variable ETHDEVNET_MNEMONIC to the mnemonic of the account that will be used to deploy the
 * contracts.
 * @dev Deploy with:
 * @dev forge script script/DeploySpokeContractsEthDevnet2.sol:DeploySpokeContractsEthDevnet2 --rpc-url
 * http://localhost:8546 --broadcast --via-ir
 */
contract DeploySpokeContractsEthDevnet2 is DeploySpokeContractsBaseImpl {
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

    return DeploymentConfiguration({
      wormholeCore: 0xC89Ce4735882C9F0f0FE26686c53074E09B0D550, // EthDevnet2 Wormhole Core
      hubChainId: 2, // EthDevnet1 Wormhole chain ID
      hubProposalMetadata: 0x25AF99b922857C37282f578F428CB7f34335B379, // From EthDevnet1 hub contracts' deployment
      votingToken: address(token),
      voteWeightWindow: 10 minutes,
      hubDispatcher: toWormholeFormat(0xd611F1AF9D056f00F49CB036759De2753EfA82c2), // Convert to Wormhole format
      spokeChainId: 4 // EthDevnet2 Wormhole chain ID
    });
  }
}
