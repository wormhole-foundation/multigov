// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {HubTestConstants} from "./HubTestConstants.sol";

abstract contract SpokeForkTestBase is Test, HubTestConstants {
  uint256 forkId;

  // --- Common Constants ---

  // Expected Parameters (Common across test spokes)
  uint16 constant EXPECTED_HUB_CHAIN_ID = 2; // Wormhole Chain ID for Ethereum Mainnet
  uint48 constant EXPECTED_AGGREGATOR_VOTE_WEIGHT_WINDOW = 5 minutes;

  // Test context
  address internal actualDeployer = 0x4135270D8bcF6b654e1169efEFc317aFA8778A83; // Address that deployed Hub
    // mainnet-test contracts

  // --- Loaded Contract Instances ---
  SpokeMessageExecutor internal executor;
  SpokeAirlock internal airlock;
  SpokeVoteAggregator internal aggregator;
  SpokeMetadataCollector internal collector;
  ERC20Votes internal wToken;

  // --- Abstract Getters for Chain-Specific Constants ---
  function _getRpcUrlEnvVarName() internal pure virtual returns (string memory);
  function _getSpokeExecutorAddress() internal pure virtual returns (address);
  function _getSpokeAirlockAddress() internal pure virtual returns (address);
  function _getSpokeAggregatorAddress() internal pure virtual returns (address);
  function _getSpokeCollectorAddress() internal pure virtual returns (address);
  function _getExpectedWormholeCore() internal pure virtual returns (address);

  function _getSelfChainId() internal view returns (uint16) {
    return IWormhole(_getExpectedWormholeCore()).chainId();
  }

  // --- Setup ---

  function setUp() public virtual {
    string memory rpcUrlEnvVar = _getRpcUrlEnvVarName();
    string memory rpcUrl = vm.envString(rpcUrlEnvVar);

    forkId = vm.createSelectFork(rpcUrl);

    address spokeExecutorAddr = _getSpokeExecutorAddress();
    address spokeAirlockAddr = _getSpokeAirlockAddress();
    address spokeAggregatorAddr = _getSpokeAggregatorAddress();
    address spokeCollectorAddr = _getSpokeCollectorAddress();

    executor = SpokeMessageExecutor(payable(spokeExecutorAddr));
    airlock = SpokeAirlock(payable(spokeAirlockAddr));
    aggregator = SpokeVoteAggregator(spokeAggregatorAddr);
    collector = SpokeMetadataCollector(spokeCollectorAddr);
    wToken = ERC20Votes(W_TOKEN_ADDR);
  }

  // --- Parameter Verification Tests ---

  function test_VerifyExecutorParams() public view {
    assertEq(address(executor.wormholeCore()), _getExpectedWormholeCore(), "Executor: wormholeCore mismatch");
    assertEq(address(executor.airlock()), _getSpokeAirlockAddress(), "Executor: airlock mismatch");
    assertEq(executor.hubChainId(), EXPECTED_HUB_CHAIN_ID, "Executor: hubChainId mismatch");
    bytes32 expectedHubDispatcherBytes = bytes32(uint256(uint160(HUB_MSG_DISPATCHER_ADDR)));
    assertEq(executor.hubDispatcher(), expectedHubDispatcherBytes, "Executor: hubDispatcher mismatch");
  }

  function test_VerifyAirlockParams() public view {
    assertEq(airlock.MESSAGE_EXECUTOR(), _getSpokeExecutorAddress(), "Airlock: executor mismatch");
  }

  function test_VerifyAggregatorParams() public view {
    assertEq(address(aggregator.VOTING_TOKEN()), W_TOKEN_ADDR, "Aggregator: wToken mismatch");
    assertEq(
      address(aggregator.spokeMetadataCollector()), _getSpokeCollectorAddress(), "Aggregator: collector mismatch"
    );
    assertEq(
      aggregator.getVoteWeightWindowLength(uint96(block.timestamp)),
      EXPECTED_AGGREGATOR_VOTE_WEIGHT_WINDOW,
      "Aggregator: voteWeightWindow mismatch"
    );
  }

  function test_VerifyCollectorParams() public view {
    assertEq(collector.HUB_CHAIN_ID(), EXPECTED_HUB_CHAIN_ID, "Collector: hubChainId mismatch");
    assertEq(collector.HUB_PROPOSAL_METADATA(), HUB_METADATA_ADDR, "Collector: hubMetadata mismatch");
  }

  // --- Role / Ownership Verification Tests ---

  function test_VerifySpokeContractOwnership() public view {
    assertEq(aggregator.owner(), _getSpokeAirlockAddress(), "Aggregator owner mismatch (Expected Airlock)");
  }

  // --- Functionality Tests ---

  function test_CastVote() public {
    uint256 _proposalId = 999;
    uint8 support = 1; // For
    address voter = actualDeployer;

    // 1. Setup voter with tokens and delegation
    deal(address(wToken), voter, 1_000_000e18);
    vm.prank(voter);
    wToken.delegate(voter);
    vm.roll(block.number + 1); // Ensure delegation registers

    // 2. Calculate vote start time and set up proposal
    uint256 voteStartTimestamp = block.timestamp + aggregator.getVoteWeightWindowLength(uint96(block.timestamp)) + 1;
    vm.store(
      address(collector), keccak256(abi.encode(bytes32(_proposalId), bytes32(uint256(0)))), bytes32(voteStartTimestamp)
    );

    // 3. Warp to voting time
    vm.warp(voteStartTimestamp + 1);

    // 4. Cast vote and verify
    vm.prank(voter);
    uint256 weight = aggregator.castVote(_proposalId, support);
    assertTrue(weight > 0, "Vote weight should be non-zero");

    // Verify vote counts
    (, uint256 against, uint256 forVotes, uint256 abstain) = aggregator.proposalVotes(_proposalId);

    if (support == 0) {
      // Against
      assertEq(against, weight);
      assertEq(forVotes, 0);
      assertEq(abstain, 0);
    } else if (support == 1) {
      // For
      assertEq(against, 0);
      assertEq(forVotes, weight);
      assertEq(abstain, 0);
    } else {
      // Abstain
      assertEq(against, 0);
      assertEq(forVotes, 0);
      assertEq(abstain, weight);
    }
  }
}
