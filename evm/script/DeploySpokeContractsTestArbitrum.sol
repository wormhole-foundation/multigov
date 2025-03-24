// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeploySpokeContractsBaseImpl} from "script/DeploySpokeContractsBaseImpl.sol";

contract DeploySpokeContractsArbitrumTest is DeploySpokeContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      wormholeCore: 0xa5f208e072434bC67592E4C49C1B991BA79BCA46,
      hubChainId: 2,
      hubProposalMetadata: 0xb2F162945eF0631F62FE4421dc6Ec5eCDf92EF59,
      votingToken: 0x99169F25429fdC6E5358A1b317Df4b95f4EAF858,
      voteWeightWindow: 10 minutes,
      hubDispatcher: 0x000000000000000000000000b2f162945ef0631f62fe4421dc6ec5ecdf92ef59,
      spokeChainId: 23
    });
  }
}
