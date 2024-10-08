// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";

contract DeployHubContractsHolesky is DeployHubContractsBaseImpl {
  function _getDeploymentConfiguration() internal override returns (DeploymentConfiguration memory) {
    Vm.Wallet memory wallet = _deploymentWallet();
    return DeploymentConfiguration({
      minDelay: 300,
      name: "",
      token: 0xf11d8878B388b2456a9Fe9F6bB979e920F340a52,
      initialVotingDelay: 1.5 minutes,
      initialVotingPeriod: 30 minutes,
      initialProposalThreshold: 500_000e18,
      initialQuorum: 1_000_000e18,
      wormholeCore: 0xa10f2eF61dE1f19f586ab8B6F2EbA89bACE63F7a,
      voteWeightWindow: 10 minutes,
      voteExtenderAdmin: wallet.addr,
      voteTimeExtension: 5 minutes,
      minimumExtensionTime: 1 minutes,
      consistencyLevel: 0,
      initialMaxQueryTimestampOffset: 10 minutes,
      expectedProgramId: 0x0000000000000000000000000000000000000000000000000000000000000000,
      solanaTokenDecimals: 8
    });
  }
}
