// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";

contract DeployHubContractsTestMainnet is DeployHubContractsBaseImpl {
  function _getDeploymentConfiguration() internal override returns (DeploymentConfiguration memory) {
    Vm.Wallet memory wallet = _deploymentWallet();
    return DeploymentConfiguration({
      minDelay: 300,
      name: "Wormhole Governor",
      token: 0x691d45404441c4a297ecCc8dE29C033afCeaac3e,
      initialVotingDelay: 1.5 minutes,
      initialVotingPeriod: 2 hours,
      initialProposalThreshold: 500_000e18,
      initialQuorum: 1_000_000e18,
      wormholeCore: 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B,
      voteWeightWindow: 10 minutes,
      voteExtenderAdmin: wallet.addr,
      voteTimeExtension: 5 minutes,
      minimumExtensionTime: 1 minutes,
      consistencyLevel: 0,
      initialMaxQueryTimestampOffset: 10 minutes,
      solanaTokenDecimals: 6
    });
  }
}
