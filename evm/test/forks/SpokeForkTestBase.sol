// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

abstract contract SpokeForkTestBase is Test {
  uint256 forkId;

  // --- Common Constants ---

  // Hub Addresses (Consistent across forks)
  address constant HUB_TIMELOCK_ADDR = 0x0fAA8fc7A60809B3557d5Dbe463B64F94de5ac06;
  address constant HUB_GOVERNOR_ADDR = 0x50b97697DbDa7a38f249966E02CCE6064657c54B;
  address constant HUB_MSG_DISPATCHER_ADDR = 0xb2F162945eF0631F62FE4421dc6Ec5eCDf92EF59;
  address constant HUB_METADATA_ADDR = 0xe1485b53e6E94aD4B82b19E48DA1911d2E19bFaE;

  // W Token Address (Consistent across forks)
  // TODO: Replace with actual WToken address for production verification (delete the above)
  address contstant W_TOKEN_ADDR = 0x99169F25429fdC6E5358A1b317Df4b95f4EAF858
  // TODO this is the actual WToken address
  // address constant W_TOKEN_ADDR = 0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91;

  // Expected Parameters (Common across test spokes)
  uint16 constant EXPECTED_HUB_CHAIN_ID = 2; // Wormhole Chain ID for Ethereum Mainnet
  uint48 constant EXPECTED_AGGREGATOR_VOTE_WEIGHT_WINDOW = 10 minutes;

  // Test context
  // TODO: Remove this once we have a way to get the actual deployer
  address internal actualDeployer = 0x6dF497fa3bC0a44F384d099FbBE47304FEE4B55B; // Address that deployed Hub
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
  function _getSelfChainId() internal pure virtual returns (uint16);
  function _getExpectedWormholeCore() internal pure virtual returns (address);

  // --- Setup ---

  function setUp() public virtual {
    string memory rpcUrlEnvVar = _getRpcUrlEnvVarName();
    console.log("rpcUrlEnvVar: %s", rpcUrlEnvVar);
    string memory rpcUrl = vm.envString(rpcUrlEnvVar);
    console.log("rpcUrl: %s", rpcUrl);

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

  function testVerifyExecutorParams() public view {
    assertEq(address(executor.wormholeCore()), _getExpectedWormholeCore(), "Executor: wormholeCore mismatch");
    assertEq(address(executor.airlock()), _getSpokeAirlockAddress(), "Executor: airlock mismatch");
    assertEq(executor.hubChainId(), EXPECTED_HUB_CHAIN_ID, "Executor: hubChainId mismatch");
    bytes32 expectedHubDispatcherBytes = bytes32(uint256(uint160(HUB_MSG_DISPATCHER_ADDR)));
    assertEq(executor.hubDispatcher(), expectedHubDispatcherBytes, "Executor: hubDispatcher mismatch");
  }

  function testVerifyAirlockParams() public view {
    assertEq(airlock.MESSAGE_EXECUTOR(), _getSpokeExecutorAddress(), "Airlock: executor mismatch");
  }

  function testVerifyAggregatorParams() public view {
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

  function testVerifyCollectorParams() public view {
    assertEq(collector.HUB_CHAIN_ID(), EXPECTED_HUB_CHAIN_ID, "Collector: hubChainId mismatch");
    assertEq(collector.HUB_PROPOSAL_METADATA(), HUB_METADATA_ADDR, "Collector: hubMetadata mismatch");
  }

  // --- Role / Ownership Verification Tests ---

  function testVerifySpokeContractOwnership() public view {
    assertEq(aggregator.owner(), _getSpokeAirlockAddress(), "Aggregator owner mismatch (Expected Airlock)");
  }
}
