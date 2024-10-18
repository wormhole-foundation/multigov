// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";

/**
 * @notice Deploy the hub contracts for EthDevnet1 when using the Wormhole Tilt testing environment (Devnet).
 * @dev Set the environment variable ETHDEVNET_MNEMONIC to the mnemonic of the account that will be used to deploy the
 * contracts.
 * @dev Deploy with:
 * @dev forge script script/DeployHubContractsEthDevnet1.sol:DeployHubContractsEthDevnet1 --rpc-url
 * http://localhost:8545 --broadcast --via-ir
 */
contract DeployHubContractsEthDevnet1 is DeployHubContractsBaseImpl {
  function _getDeploymentConfiguration() internal override returns (DeploymentConfiguration memory) {
    Vm.Wallet memory wallet = _deploymentWallet();
    return DeploymentConfiguration({
      minDelay: 300,
      name: "Wormhole EthDevnet1 Governor",
      token: 0x2D8BE6BF0baA74e0A907016679CaE9190e80dD0A,
      initialVotingDelay: 1.5 minutes,
      initialVotingPeriod: 30 minutes,
      initialProposalThreshold: 500_000e18,
      initialQuorum: 1_000_000e18,
      wormholeCore: 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B, // EthDevnet1 Wormhole Core
      voteWeightWindow: 10 minutes,
      voteExtenderAdmin: wallet.addr,
      voteTimeExtension: 5 minutes,
      minimumExtensionTime: 1 minutes,
      consistencyLevel: 0,
      initialMaxQueryTimestampOffset: 10 minutes,
      expectedProgramId: 0x0000000000000000000000000000000000000000000000000000000000000000,
      solanaTokenDecimals: 8
    });
  }
}
