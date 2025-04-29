// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubForkTestBase} from "./HubForkTestBase.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

// This contract tests the state IMMEDIATELY after initial deployment.
contract HubMainnetForkTest is HubForkTestBase {
  function test_VerifyTimelockParams() public view {
    assertEq(timelock.getMinDelay(), EXPECTED_MIN_DELAY, "Timelock minDelay mismatch");
  }

  function test_VerifyGovernorParams() public view {
    assertEq(gov.name(), EXPECTED_GOV_NAME, "Governor name mismatch");
    assertEq(address(gov.token()), W_TOKEN_ADDR, "Governor token mismatch");
    assertEq(address(gov.timelock()), TIMELOCK_ADDR, "Governor timelock mismatch");
    assertEq(gov.votingDelay(), EXPECTED_VOTING_DELAY, "Governor votingDelay mismatch");
    assertEq(gov.votingPeriod(), EXPECTED_VOTING_PERIOD, "Governor votingPeriod mismatch");
    assertEq(gov.proposalThreshold(), EXPECTED_PROPOSAL_THRESHOLD, "Governor proposalThreshold mismatch");
    assertEq(gov.quorum(block.timestamp), EXPECTED_QUORUM, "Governor initialQuorum mismatch");
    assertEq(address(gov.hubVotePool(uint96(block.timestamp))), HUB_VOTE_POOL_ADDR, "Governor hubVotePool mismatch");
    assertEq(address(gov.HUB_PROPOSAL_EXTENDER()), EXTENDER_ADDR, "Governor governorProposalExtender mismatch");
    assertEq(
      gov.getVoteWeightWindowLength(uint96(block.timestamp)),
      EXPECTED_VOTE_WEIGHT_WINDOW,
      "Governor voteWeightWindow mismatch"
    );
  }

  function test_VerifyExtenderParams() public view {
    assertEq(extender.extensionDuration(), EXPECTED_VOTE_TIME_EXTENSION, "Extender extensionDuration mismatch");
    assertEq(
      extender.MINIMUM_EXTENSION_DURATION(), EXPECTED_MIN_EXTENSION_TIME, "Extender minExtensionDuration mismatch"
    );
    // Initial admin check (should be deployer before registration script/governance action)
    assertEq(
      extender.voteExtenderAdmin(),
      WORMHOLE_FOUNDATION_ADDR,
      "Extender initial admin should be WORMHOLE_FOUNDATION_ADDR"
    );
    // Owner check (should be Timelock as set during deployment)
    assertEq(extender.owner(), TIMELOCK_ADDR, "Extender owner mismatch");
  }

  function test_VerifyVotePoolParams() public view {
    assertEq(address(hubVotePool.wormhole()), EXPECTED_WORMHOLE_CORE, "VotePool wormholeCore mismatch");
    assertEq(address(hubVotePool.hubGovernor()), GOV_ADDR, "VotePool governor mismatch");
  }

  function test_VerifyMetadataParams() public view {
    assertEq(address(hubProposalMetadata.GOVERNOR()), GOV_ADDR, "Metadata governor mismatch");
  }

  function test_VerifyEvmDispatcherParams() public view {
    assertEq(
      address(hubMessageDispatcher.wormholeCore()), EXPECTED_WORMHOLE_CORE, "EvmDispatcher wormholeCore mismatch"
    );
    assertEq(
      hubMessageDispatcher.consistencyLevel(), EXPECTED_CONSISTENCY_LEVEL, "EvmDispatcher consistencyLevel mismatch"
    );
  }

  function test_VerifySolanaDispatcherParams() public view {
    assertEq(
      address(hubSolanaMessageDispatcher.wormholeCore()),
      EXPECTED_WORMHOLE_CORE,
      "SolanaDispatcher wormholeCore mismatch"
    );
    assertEq(
      hubSolanaMessageDispatcher.consistencyLevel(),
      EXPECTED_CONSISTENCY_LEVEL,
      "SolanaDispatcher consistencyLevel mismatch"
    );
  }

  function test_VerifyEvmProposerParams() public view {
    assertEq(
      address(hubEvmSpokeAggregateProposer.wormhole()), EXPECTED_WORMHOLE_CORE, "EvmAggProposer wormholeCore mismatch"
    );
    assertEq(address(hubEvmSpokeAggregateProposer.HUB_GOVERNOR()), GOV_ADDR, "EvmAggProposer governor mismatch");
    assertEq(
      hubEvmSpokeAggregateProposer.maxQueryTimestampOffset(),
      EXPECTED_MAX_QUERY_OFFSET,
      "EvmAggProposer maxQueryTimestampOffset mismatch"
    );
  }

  function test_VerifySolanaDecoderParams() public view {
    assertEq(
      address(hubSolanaSpokeVoteDecoder.wormhole()), EXPECTED_WORMHOLE_CORE, "SolanaDecoder wormholeCore mismatch"
    );
    assertEq(address(hubSolanaSpokeVoteDecoder.HUB_VOTE_POOL()), HUB_VOTE_POOL_ADDR, "SolanaDecoder target mismatch");
    assertEq(
      hubSolanaSpokeVoteDecoder.SOLANA_TOKEN_DECIMALS(),
      EXPECTED_SOLANA_DECIMALS,
      "SolanaDecoder tokenDecimals mismatch"
    );
    assertEq(address(hubVotePool.voteTypeDecoder(5)), HUB_SOLANA_VOTE_DECODER_ADDR, "SolanaDecoder query type mismatch");
  }

  // --- Role / Ownership Verification Tests (Initial State) ---

  function test_VerifyWhitelistedProposerInitial() public view {
    assertEq(gov.whitelistedProposer(), address(0), "Initial WhitelistedProposer should be address(0)");
  }

  function test_VerifyContractOwnershipInitial() public {
    vm.createSelectFork(ETHEREUM_RPC_URL, 22_296_816); // Before registration
    assertEq(hubVotePool.owner(), actualDeployer, "VotePool initial owner mismatch");
    assertEq(hubMessageDispatcher.owner(), TIMELOCK_ADDR, "EvmDispatcher owner mismatch");
    assertEq(hubSolanaMessageDispatcher.owner(), TIMELOCK_ADDR, "SolanaDispatcher owner mismatch");
    assertEq(hubEvmSpokeAggregateProposer.owner(), GOV_ADDR, "EvmAggProposer owner mismatch");
  }

  // --- Functionality Tests ---

  function test_CanProposeOnHub() public {
    address proposer = PROPOSER_ADDRESS;
    string memory description = "Test Proposal: Verify Hub Proposal Creation";

    _setupProposerAndDelegate(proposer);
    (address[] memory targets, uint256[] memory values, bytes[] memory calldatas,) =
      _prepareSimpleProposalData(description);

    uint256 proposalId = _proposeFrom(proposer, targets, values, calldatas, description);

    uint48 votingDelay = EXPECTED_VOTING_DELAY;
    vm.warp(block.timestamp + votingDelay + 1);

    assertEq(uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Active), "Proposal not Active");
  }

  function test_ProposerCanCancel() public {
    address proposer = PROPOSER_ADDRESS;
    string memory description = "Test Proposal: Verify Proposer Cancellation";

    _setupProposerAndDelegate(proposer);
    (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) =
      _prepareSimpleProposalData(description);

    uint256 proposalId = _proposeFrom(proposer, targets, values, calldatas, description);

    assertEq(uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Pending), "Proposal not Pending initially");

    vm.prank(proposer);
    gov.cancel(targets, values, calldatas, descriptionHash);

    assertEq(
      uint8(gov.state(proposalId)),
      uint8(IGovernor.ProposalState.Canceled),
      "Proposal not Canceled after proposer cancel"
    );
  }

  function test_CanExtendProposal() public {
    address proposer = PROPOSER_ADDRESS;
    string memory description = "Test Proposal: Verify Extension";

    _setupProposerAndDelegate(proposer);
    (address[] memory targets, uint256[] memory values, bytes[] memory calldatas,) =
      _prepareSimpleProposalData(description);

    uint256 proposalId = _proposeFrom(proposer, targets, values, calldatas, description);

    vm.warp(block.timestamp + EXPECTED_VOTING_DELAY + 1);
    assertEq(
      uint8(gov.state(proposalId)), uint8(IGovernor.ProposalState.Active), "Proposal not Active before extension"
    );

    uint256 initialDeadline = gov.proposalDeadline(proposalId);

    vm.prank(WORMHOLE_FOUNDATION_ADDR);
    extender.extendProposal(proposalId);

    uint256 newDeadline = gov.proposalDeadline(proposalId);
    uint256 expectedNewDeadline = initialDeadline + EXPECTED_VOTE_TIME_EXTENSION;
    assertEq(newDeadline, expectedNewDeadline, "Proposal deadline did not extend correctly");
    assertTrue(newDeadline > initialDeadline, "New deadline not after initial deadline");
  }
}
