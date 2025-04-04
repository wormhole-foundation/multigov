// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

// Spoke Contracts
import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";
import {SpokeAirlock} from "src/SpokeAirlock.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";

// Hub Contracts (for addresses/interfaces)
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubMessageDispatcher} from "src/HubMessageDispatcher.sol"; // Assuming this is the target for MetadataCollector

// Other
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract OptimismForkTest is Test {
  string OPTIMISM_RPC_URL = vm.envString("OPTIMISM_RPC_URL");
  uint256 optimismForkId;

  // Optimism Deployed Addresses (from mainnet-test-deploy-contracts.md)
  address constant SPOKE_EXECUTOR_ADDR = 0xDaEfB7A94027c9c1414c27e84B9667a8f4bEC365;
  address constant SPOKE_COLLECTOR_ADDR = 0x423Da2a1D7e14f22B60cd9A5bd83d714f3AFe2De;
  address constant SPOKE_AGGREGATOR_ADDR = 0x75F755950D59d2007A0C90457fDc190732567cC5;
  address constant SPOKE_AIRLOCK_ADDR = 0x6753c396D52744ac82AEd0f62F9E3420ea7589da;
  // TODO: Needs to be updated to the correct address during prod deployment
  address constant SPOKE_WTOKEN_ADDR = 0x99169F25429fdC6E5358A1b317Df4b95f4EAF858;
  //   address constant SPOKE_WTOKEN_ADDR = 0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91;

  // Hub Contract Addresses (from HubMainnetForkTest.t.sol or mainnet-test-deploy-contracts.md)
  address constant HUB_TIMELOCK_ADDR = 0x0fAA8fc7A60809B3557d5Dbe463B64F94de5ac06;
  address constant HUB_GOVERNOR_ADDR = 0x50b97697DbDa7a38f249966E02CCE6064657c54B;
  address constant HUB_MSG_DISPATCHER_ADDR = 0xb2F162945eF0631F62FE4421dc6Ec5eCDf92EF59; // Used by Executor
  address constant HUB_METADATA_ADDR = 0xe1485b53e6E94aD4B82b19E48DA1911d2E19bFaE; // Used by Collector

  // Expected Parameters
  address constant EXPECTED_WORMHOLE_CORE = 0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722;
  uint16 constant EXPECTED_HUB_CHAIN_ID = 2; // Wormhole Chain ID for Ethereum Mainnet
  uint16 constant SELF_CHAIN_ID = 24; // Optimism Mainnet Wormhole Chain ID
  uint48 constant EXPECTED_AGGREGATOR_VOTE_WEIGHT_WINDOW = 10 minutes;
  // deploy script

  // Test context
  address internal actualDeployer = 0x6dF497fa3bC0a44F384d099FbBE47304FEE4B55B; // Address that deployed Hub
    // mainnet-test contracts

  // Loaded Contract Instances
  SpokeMessageExecutor internal executor;
  SpokeAirlock internal airlock;
  SpokeVoteAggregator internal aggregator;
  SpokeMetadataCollector internal collector;
  ERC20Votes internal wToken;

  function setUp() public {
    optimismForkId = vm.createSelectFork(OPTIMISM_RPC_URL);

    executor = SpokeMessageExecutor(payable(SPOKE_EXECUTOR_ADDR));
    airlock = SpokeAirlock(payable(SPOKE_AIRLOCK_ADDR));
    aggregator = SpokeVoteAggregator(SPOKE_AGGREGATOR_ADDR);
    collector = SpokeMetadataCollector(SPOKE_COLLECTOR_ADDR);
    wToken = ERC20Votes(SPOKE_WTOKEN_ADDR);
  }

  // --- Parameter Verification Tests ---

  function testVerifyExecutorParams() public view {
    // NOTE: This checks the intended final production Wormhole Core address.
    // It may FAIL against the current test deployment if its Core address differs.
    assertEq(address(executor.wormholeCore()), EXPECTED_WORMHOLE_CORE, "Executor: wormholeCore mismatch");
    assertEq(address(executor.airlock()), SPOKE_AIRLOCK_ADDR, "Executor: airlock mismatch");
    assertEq(executor.hubChainId(), EXPECTED_HUB_CHAIN_ID, "Executor: hubChainId mismatch");
    bytes32 expectedHubDispatcherBytes = bytes32(uint256(uint160(HUB_MSG_DISPATCHER_ADDR)));
    assertEq(executor.hubDispatcher(), expectedHubDispatcherBytes, "Executor: hubDispatcher mismatch");
  }

  function testVerifyAirlockParams() public view {
    assertEq(airlock.MESSAGE_EXECUTOR(), SPOKE_EXECUTOR_ADDR, "Airlock: executor mismatch");
  }

  function testVerifyAggregatorParams() public view {
    assertEq(address(aggregator.VOTING_TOKEN()), SPOKE_WTOKEN_ADDR, "Aggregator: wToken mismatch");
    assertEq(address(aggregator.spokeMetadataCollector()), SPOKE_COLLECTOR_ADDR, "Aggregator: collector mismatch");
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
    assertEq(aggregator.owner(), SPOKE_AIRLOCK_ADDR, "Aggregator owner mismatch (Expected Airlock)");
  }
}
