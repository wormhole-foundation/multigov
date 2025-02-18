// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsBaseSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x79A1027a6A159502049F10906D333EC57E95F083, // Base Sepolia Wormhole Core
      hubChainId: 10_002, // Sepolia hub chain ID
      hubProposalMetadata: 0x1A3E5624769C3Dc9106347A239523e4A08d85C38,
      votingToken: 0x12Fb7f85dea3A3F83018E4A647dC8B0456dF9B39,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x000000000000000000000000027e445be20889f0e6ddd30372842e6c183d3648b,
      spokeChainId: 10_004 // Base Sepolia Wormhole chain ID
    });
  }
}
