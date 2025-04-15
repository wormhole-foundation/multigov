// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {DeployHubContractsBaseImpl} from "script/DeployHubContractsBaseImpl.s.sol";

contract DeployHubContractsMainnet is DeployHubContractsBaseImpl {
  function _getDeploymentConfiguration() internal override returns (DeploymentConfiguration memory) {
    Vm.Wallet memory wallet = _deploymentWallet();
    return DeploymentConfiguration({
      minDelay: 4 days,
      name: "Wormhole Governor",
      token: 0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91,
      initialVotingDelay: 2 days,
      initialVotingPeriod: 5 days,
      initialProposalThreshold: 1_000_000e18,
      initialQuorum: 350_000_000e18,
      wormholeCore: 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B,
      voteWeightWindow: 5 minutes,
      voteExtenderAdmin: 0x4afAa38A39a1A80F4fe13DA24Bf4AB70d3455CF7,
      voteTimeExtension: 24 hours,
      minimumExtensionTime: 12 hours,
      consistencyLevel: 0,
      initialMaxQueryTimestampOffset: 5 minutes,
      solanaTokenDecimals: 6
    });
  }
}
