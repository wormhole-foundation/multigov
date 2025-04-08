// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubForkTestBase} from "./HubForkTestBase.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

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

  function test_TimelockCanCancelScheduledOperation() public {
    address proposer = PROPOSER_ADDRESS;
    address canceller = GOV_ADDR;
    string memory description = "Test Proposal: Verify Timelock Cancellation of Scheduled Op";

    (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) =
      _prepareSimpleProposalData(description);

    // 1. Propose
    uint256 proposalId = _proposeFrom(proposer, targets, values, calldatas, description);
    assertEq(uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Pending), "Proposal not Pending initially");

    // 2. Simulate Voting Period
    vm.warp(block.timestamp + EXPECTED_VOTING_DELAY + 1); // Warp past voting delay
    assertEq(uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Active), "Proposal not Active after delay");
    vm.prank(proposer); // Use the proposer who has votes from setUp
    gov.castVote(proposalId, 1); // Vote For
    vm.warp(block.timestamp + EXPECTED_VOTING_PERIOD + 1); // Warp past voting period
    assertEq(
      uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Succeeded), "Proposal not Succeeded after vote"
    );

    // 3. Queue the proposal (schedules it on Timelock)
    gov.queue(targets, values, calldatas, descriptionHash);
    assertEq(
      uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Queued), "Proposal not Queued after queue call"
    );

    // 4. Calculate the Timelock operation ID
    bytes32 predecessor = bytes32(0);
    bytes32 salt = bytes20(address(gov)) ^ descriptionHash;
    bytes32 timelockId = timelock.hashOperationBatch(targets, values, calldatas, predecessor, salt);

    // 5. Verify the operation is Waiting on the Timelock
    assertEq(uint8(timelock.getOperationState(timelockId)), 1, "Operation should be Waiting (1) after queue");

    // 6. Cancel directly on the Timelock
    vm.prank(canceller);
    timelock.cancel(timelockId);

    // 7. Verify the operation is now Unset
    assertEq(uint8(timelock.getOperationState(timelockId)), 0, "Operation should be Unset (0) after cancel");

    // 8. Verify Governor state becomes Canceled
    assertEq(
      uint8(gov.state(proposalId)),
      uint8(IGovernor.ProposalState.Canceled),
      "Governor state should become Canceled after Timelock cancel"
    );
  }
}
