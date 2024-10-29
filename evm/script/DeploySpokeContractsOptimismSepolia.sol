// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe,
      hubChainId: 10_002,
      hubProposalMetadata: 0x26c73662633Bd0d4A6BA231A1001BBbCED8D2b21,
      votingToken: 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x0000000000000000000000006daeac1b1296627f7c180c7f1552e63b5e2cbad1,
      spokeChainId: 10_005
    });
  }
}
