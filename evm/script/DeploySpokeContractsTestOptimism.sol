// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsOptimismTest is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722,
      hubChainId: 2,
      hubProposalMetadata: 0xb2F162945eF0631F62FE4421dc6Ec5eCDf92EF59,
      votingToken: 0xbb7F5Dd82ECf91b448526F88Bb6A525096A7246B,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x000000000000000000000000b2f162945ef0631f62fe4421dc6ec5ecdf92ef59,
      spokeChainId: 24
    });
  }
}
