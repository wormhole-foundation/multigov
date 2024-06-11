// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe,
      hubChainId: 10_002,
      hubProposalMetadata: 0xe139982C9f0810C110a386eAd2A153217eCcB9D6,
      votingToken: 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4,
      safeWindow: 180,
      voteWeightWindow: 10 minutes
    });
  }
}
