// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";
import {toWormholeFormat} from "wormhole-sdk/Utils.sol";

/**
 * @notice Deploy the spoke contracts for EthDevnet2 when using the Wormhole Tilt testing environment (Devnet).
 * @dev Set the environment variable ETHDEVNET_MNEMONIC to the mnemonic of the account that will be used to deploy the
 * contracts.
 * @dev Deploy with:
 * @dev forge script script/DeploySpokeContractsEthDevnet2.sol:DeploySpokeContractsEthDevnet2 --rpc-url
 * http://localhost:8546 --broadcast --via-ir
 */
contract DeploySpokeContractsEthDevnet2 is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0xC89Ce4735882C9F0f0FE26686c53074E09B0D550, // EthDevnet2 Wormhole Core
      hubChainId: 2, // EthDevnet1 Wormhole chain ID
      hubProposalMetadata: 0xC5aFE31AE505594B190AC71EA689B58139d1C354, // From EthDevnet1 hub contracts' deployment
      votingToken: 0x2D8BE6BF0baA74e0A907016679CaE9190e80dD0A,
      voteWeightWindow: 10 minutes,
      hubDispatcher: toWormholeFormat(0x42D4BA5e542d9FeD87EA657f0295F1968A61c00A), // Convert to Wormhole format
      spokeChainId: 4 // EthDevnet2 Wormhole chain ID
    });
  }
}
