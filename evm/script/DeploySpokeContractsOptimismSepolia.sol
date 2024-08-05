// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe,
      hubChainId: 10_002,
      hubProposalMetadata: 0x2574802Db8590ee5C9EFC5eBeBFef1E174b712FC,
      votingToken: 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4,
      voteWeightWindow: 10 minutes,
      hubDispatcher:  0x000000000000000000000000fa9ebf6ec7a06aeb40fd32e7d7b2146b328c19e1,
      spokeChainId: 10_005
    });
  }
}
