// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismSepolia is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe,
      hubChainId: 10_002,
      hubProposalMetadata: 0x73D661E8b3841cddab14a447C6f2459544dEa27b,
      votingToken: 0x74f00907CFC6E44Fb72535cdD1eC52a37EacAbE4,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x00000000000000000000000002cd4a674a29973911d5d291b14cab75b267062c,
      spokeChainId: 10_005
    });
  }
}
