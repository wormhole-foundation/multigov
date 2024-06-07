// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";

contract DeployHubContractsSepolia is DeployHubContractsBaseImpl {
  function _getDeploymentConfiguration() internal pure override returns (DeploymentConfiguration memory) {
    return DeploymentConfiguration({
      minDelay: 300,
      name: "Wormhole Sepolia Governor",
      token: 0x4b56814a4A5b38De8406F3E04F5b39628658cD1B,
      initialVotingDelay: 90,
      initialVotingPeriod: 1800,
      initialProposalThreshold: 500_000e18,
      initialQuorum: 1_000_000e18,
      wormholeCore: 0x31377888146f3253211EFEf5c676D41ECe7D58Fe
    });
  }
}
