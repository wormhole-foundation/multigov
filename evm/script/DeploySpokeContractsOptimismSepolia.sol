// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe,
      hubChainId: 10_002,
      hubProposalMetadata: 0x0D500a8A3A20E003FD0C0bd24813C00264297E90,
      votingToken: 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x000000000000000000000000a86c31eb2c8865659c6e3f119563723663a79388,
      spokeChainId: 10_005
    });
  }
}
