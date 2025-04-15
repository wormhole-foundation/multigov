// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimism is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722,
      hubChainId: 2,
      hubProposalMetadata: 0xE92610200A579A09Fe440f697C19afadDa8a7fE8,
      votingToken: 0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91,
      voteWeightWindow: 5 minutes,
      hubDispatcher: 0x0000000000000000000000009b3679b7e3e51d4f1e0eef3977b400011365cbce,
      spokeChainId: 24
    });
  }
}
