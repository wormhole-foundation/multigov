// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubForkTestBase} from "./HubForkTestBase.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

// This contract tests the state AFTER the registration script has run.
contract HubMainnetPostRegistrationForkTest is HubForkTestBase {
  function test_VerifySpokeRegistrations() public view {
    bytes32 expectedArbBytes = bytes32(uint256(uint160(ARBITRUM_SPOKE_AGG_ADDR)));
    bytes32 expectedBaseBytes = bytes32(uint256(uint160(BASE_SPOKE_AGG_ADDR)));
    bytes32 expectedOpBytes = bytes32(uint256(uint160(OPTIMISM_SPOKE_AGG_ADDR)));

    assertEq(
      hubVotePool.getSpoke(ARBITRUM_CHAIN_ID, block.timestamp),
      expectedArbBytes,
      "Arbitrum spoke not registered correctly"
    );
    assertEq(
      hubVotePool.getSpoke(BASE_CHAIN_ID, block.timestamp), expectedBaseBytes, "Base spoke not registered correctly"
    );
    assertEq(
      hubVotePool.getSpoke(OPTIMISM_CHAIN_ID, block.timestamp),
      expectedOpBytes,
      "Optimism spoke not registered correctly"
    );
  }

  function test_VerifyWhitelistedProposer() public view {
    assertEq(
      gov.whitelistedProposer(),
      HUB_EVM_AGG_PROPOSER_ADDR,
      "WhitelistedProposer mismatch post-registration (Expected EvmAggProposer)"
    );
  }

  function test_VerifyExtenderRoles() public view {
    assertEq(extender.voteExtenderAdmin(), WORMHOLE_FOUNDATION_ADDR, "Extender admin mismatch (Expected Foundation)");
    assertEq(extender.owner(), TIMELOCK_ADDR, "Extender owner mismatch post-registration (Expected Timelock)");
  }

  function test_VerifyTimelockRoles() public view {
    assertTrue(timelock.hasRole(PROPOSER_ROLE, GOV_ADDR), "Governor lacks PROPOSER_ROLE");
    assertTrue(timelock.hasRole(EXECUTOR_ROLE, GOV_ADDR), "Governor lacks EXECUTOR_ROLE");
    assertTrue(timelock.hasRole(CANCELLER_ROLE, GOV_ADDR), "Governor lacks CANCELLER_ROLE");
    assertTrue(timelock.hasRole(CANCELLER_ROLE, WORMHOLE_FOUNDATION_ADDR), "Foundation lacks CANCELLER_ROLE");
    assertTrue(timelock.hasRole(TIMELOCK_ADMIN_ROLE, TIMELOCK_ADDR), "Timelock lacks TIMELOCK_ADMIN_ROLE");
    assertFalse(timelock.hasRole(TIMELOCK_ADMIN_ROLE, actualDeployer), "Deployer still has TIMELOCK_ADMIN_ROLE");
  }

  function test_VerifyHubVotePoolOwnershipPostRegistration() public view {
    assertEq(hubVotePool.owner(), TIMELOCK_ADDR, "VotePool owner should be Timelock post-registration");
  }
}
