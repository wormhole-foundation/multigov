// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

/// @notice Deploy the hub contracts for EthDevnet1 when using the Wormhole Tilt testing environment (Devnet).
/// @dev Set the environment variable DEPLOYER_PRIVATE_KEY to the private key of the account that will be used to deploy
/// the contracts.
/// @dev Deploy with:
/// forge script script/DeployHubContractsEthDevnet1.sol:DeployHubContractsEthDevnet1 --rpc-url
/// http://localhost:8545 --broadcast --via-ir
contract DeployHubContractsEthDevnet1 is DeployHubContractsBaseImpl {
  function _getDeploymentConfiguration() internal override returns (DeploymentConfiguration memory) {
    Vm.Wallet memory wallet = _deploymentWallet();

    vm.startBroadcast(wallet.privateKey);

    bytes32 salt = keccak256(abi.encodePacked("WormholeGovernanceHubContracts"));
    bytes memory bytecode =
      abi.encodePacked(type(ERC20VotesFake).creationCode, abi.encode("MultiGov Governance Token", "MGT", 18));
    address tokenAddress = Create2.deploy(0, salt, bytecode);
    // Deploy ERC20VotesFake using CREATE2
    ERC20VotesFake token = ERC20VotesFake(tokenAddress);

    uint256 initialSupply = 1_000_000_000e18; // 1 billion tokens
    token.mint(wallet.addr, initialSupply);
    vm.stopBroadcast();

    return DeploymentConfiguration({
      minDelay: 300,
      name: "Wormhole EthDevnet1 Governor",
      token: address(token),
      initialVotingDelay: 1.5 minutes,
      initialVotingPeriod: 30 minutes,
      initialProposalThreshold: 500_000e18,
      initialQuorum: 1_000_000e18,
      wormholeCore: 0xC89Ce4735882C9F0f0FE26686c53074E09B0D550, // EthDevnet1 Wormhole Core
      voteWeightWindow: 10 minutes,
      voteExtenderAdmin: wallet.addr,
      voteTimeExtension: 5 minutes,
      minimumExtensionTime: 1 minutes,
      consistencyLevel: 0,
      initialMaxQueryTimestampOffset: 10 minutes,
      solanaTokenDecimals: 6
    });
  }
}
