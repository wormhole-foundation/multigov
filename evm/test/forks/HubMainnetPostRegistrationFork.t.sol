// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";
import {HubEvmSpokeAggregateProposer} from "src/HubEvmSpokeAggregateProposer.sol";
import {HubSolanaMessageDispatcher} from "src/HubSolanaMessageDispatcher.sol";
import {HubSolanaSpokeVoteDecoder} from "src/HubSolanaSpokeVoteDecoder.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {HubTestConstants} from "./HubTestConstants.sol";

// This contract tests the state AFTER the registration script has run.
contract HubMainnetPostRegistrationForkTest is Test, HubTestConstants {
  string ETHEREUM_RPC_URL = vm.envString("ETHEREUM_RPC_URL");
  uint256 ethereumForkId;

  address internal actualDeployer = 0x6dF497fa3bC0a44F384d099FbBE47304FEE4B55B;
  address public PROPOSER_ADDRESS = actualDeployer;
  address public EXPECTED_EXTENDER_ADMIN = actualDeployer; // Keep as deployer for test setup, but test checks
    // Foundation

  TimelockController internal timelock;
  HubGovernor internal gov;
  HubProposalExtender internal extender;
  HubVotePool internal hubVotePool;
  HubProposalMetadata internal hubProposalMetadata;
  HubMessageDispatcher internal hubMessageDispatcher;
  HubEvmSpokeAggregateProposer internal hubEvmSpokeAggregateProposer;
  HubSolanaMessageDispatcher internal hubSolanaMessageDispatcher;
  HubSolanaSpokeVoteDecoder internal hubSolanaSpokeVoteDecoder;
  ERC20Votes internal wToken;

  function setUp() public {
    ethereumForkId = vm.createSelectFork(ETHEREUM_RPC_URL);

    timelock = TimelockController(payable(TIMELOCK_ADDR));
    gov = HubGovernor(payable(GOV_ADDR));
    extender = HubProposalExtender(EXTENDER_ADDR);
    hubVotePool = HubVotePool(HUB_VOTE_POOL_ADDR);
    hubProposalMetadata = HubProposalMetadata(HUB_METADATA_ADDR);
    hubMessageDispatcher = HubMessageDispatcher(HUB_MSG_DISPATCHER_ADDR);
    hubEvmSpokeAggregateProposer = HubEvmSpokeAggregateProposer(HUB_EVM_AGG_PROPOSER_ADDR);
    hubSolanaMessageDispatcher = HubSolanaMessageDispatcher(HUB_SOLANA_DISPATCHER_ADDR);
    hubSolanaSpokeVoteDecoder = HubSolanaSpokeVoteDecoder(HUB_SOLANA_VOTE_DECODER_ADDR);
    wToken = ERC20Votes(W_TOKEN_ADDR);
  }

  // --- Tests for Post-Registration State ---

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
