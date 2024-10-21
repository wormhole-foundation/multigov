// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe,
      hubChainId: 10_006,
      hubProposalMetadata: 0xf8269e80C6f75ae3394B7238Cfce21eF30306c5b,
      votingToken: 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x0000000000000000000000001f86472956f506b4b5eb8f7acbe0215c4a93711b,
      spokeChainId: 10_005
    });
  }
}
