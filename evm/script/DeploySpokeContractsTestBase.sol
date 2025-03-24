// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsBaseTest is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6,
      hubChainId: 2,
      hubProposalMetadata:  0xe1485b53e6E94aD4B82b19E48DA1911d2E19bFaE,
      votingToken: 0x99169F25429fdC6E5358A1b317Df4b95f4EAF858,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x000000000000000000000000b2f162945ef0631f62fe4421dc6ec5ecdf92ef59,
      spokeChainId: 30
    });
  }
}
