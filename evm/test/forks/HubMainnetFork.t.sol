// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

// Hub Contracts
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

contract HubMainnetForkTest is Test {
  string MAINNET_RPC_URL = vm.envString("MAINNET_RPC_URL");

  // Deployed Contract Addresses (from mainnet-test-deploy-contracts.md)
  address constant TIMELOCK_ADDR = 0x0fAA8fc7A60809B3557d5Dbe463B64F94de5ac06;
  address constant EXTENDER_ADDR = 0xB85D4a7D0661Afa0EFEFF9E3B6Fc82bf427e6C69;
  address constant HUB_VOTE_POOL_ADDR = 0x6D87469dC04aec896dB03Df9B1b9Ba29535CC206;
  address constant GOV_ADDR = 0x50b97697DbDa7a38f249966E02CCE6064657c54B;
  address constant HUB_EVM_VOTE_DECODER_ADDR = 0xa891e332E50E2d3105a5F9b85cFBbFc1D8E05541;
  address constant HUB_SOLANA_VOTE_DECODER_ADDR = 0xc70cc0f137fA23b5A42EE48a9A48E52c345E8dA4;
  address constant HUB_METADATA_ADDR = 0xe1485b53e6E94aD4B82b19E48DA1911d2E19bFaE;
  address constant HUB_MSG_DISPATCHER_ADDR = 0xb2F162945eF0631F62FE4421dc6Ec5eCDf92EF59;
  address constant HUB_SOLANA_DISPATCHER_ADDR = 0xadB8de6dfB41a1Fce6635460E77bEaDc73148BE4;
  address constant HUB_EVM_AGG_PROPOSER_ADDR = 0xb2490491FBb846B314D3ce65D77f9f27Ef964b4F;
  address constant TEST_WTOKEN_ADDR = 0x691d45404441c4a297ecCc8dE29C033afCeaac3e;

  // Testnet Spoke Addresses & Chain IDs (from mainnet-test-deploy-contracts.md & scripts)
  address constant ARBITRUM_SPOKE_AGG_ADDR = 0x6dEfA659A9726925307a45B30Ffe2Da45ED90811;
  uint16 constant ARBITRUM_CHAIN_ID = 23;
  address constant BASE_SPOKE_AGG_ADDR = 0x31eD7EAa0CCA7e95a93339843a1C257b87e31E3d;
  uint16 constant BASE_CHAIN_ID = 30;
  address constant OPTIMISM_SPOKE_AGG_ADDR = 0x75F755950D59d2007A0C90457fDc190732567cC5;
  uint16 constant OPTIMISM_CHAIN_ID = 24;

  // Expected Parameters (based on DeployHubContractsTestMainnet.sol configuration)
  uint256 constant EXPECTED_MIN_DELAY = 300;
  string constant EXPECTED_GOV_NAME = "Wormhole Governor";
  uint48 constant EXPECTED_VOTING_DELAY = 1.5 minutes;
  uint32 constant EXPECTED_VOTING_PERIOD = 2 hours;
  uint256 constant EXPECTED_PROPOSAL_THRESHOLD = 500_000e18;
  uint208 constant EXPECTED_QUORUM = 1_000_000e18;
  address constant EXPECTED_WORMHOLE_CORE = 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B;
  uint48 constant EXPECTED_VOTE_WEIGHT_WINDOW = 10 minutes;
  // address constant EXPECTED_EXTENDER_ADMIN = <<NEEDS ACTUAL DEPLOYER ADDRESS>>; // Use deployer for now
  uint48 constant EXPECTED_VOTE_TIME_EXTENSION = 5 minutes;
  uint48 constant EXPECTED_MIN_EXTENSION_TIME = 1 minutes;
  uint8 constant EXPECTED_CONSISTENCY_LEVEL = 0;
  uint48 constant EXPECTED_MAX_QUERY_OFFSET = 10 minutes;
  uint8 constant EXPECTED_SOLANA_DECIMALS = 6;

  // Loaded Contract Instances
  TimelockController internal timelock;
  HubGovernor internal gov;
  HubProposalExtender internal extender;
  HubVotePool internal hubVotePool;
  HubProposalMetadata internal hubProposalMetadata;
  HubMessageDispatcher internal hubMessageDispatcher;
  HubEvmSpokeAggregateProposer internal hubEvmSpokeAggregateProposer;
  HubSolanaMessageDispatcher internal hubSolanaMessageDispatcher;
  HubSolanaSpokeVoteDecoder internal hubSolanaSpokeVoteDecoder;
  ERC20Votes internal testWToken;

  // Test context
  address internal actualDeployer = 0x6dF497fa3bC0a44F384d099FbBE47304FEE4B55B; // Address that deployed the contracts
    // to mainnet test; TODO: Replace with actual deployer address for prod mainnet deploy

  // Roles
  bytes32 public constant TIMELOCK_ADMIN_ROLE = 0x00; // bytes32(0)
  bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
  bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
  bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

  function setUp() public {
    // Create a fork of mainnet
    uint256 forkId = vm.createSelectFork(MAINNET_RPC_URL);
    assertTrue(forkId > 0, "Fork creation failed");

    console.log("Deployer Address:", actualDeployer);

    // Load contract instances from known addresses
    timelock = TimelockController(TIMELOCK_ADDR);
    gov = HubGovernor(GOV_ADDR);
    extender = HubProposalExtender(EXTENDER_ADDR);
    hubVotePool = HubVotePool(HUB_VOTE_POOL_ADDR);
    hubProposalMetadata = HubProposalMetadata(HUB_METADATA_ADDR);
    hubMessageDispatcher = HubMessageDispatcher(HUB_MSG_DISPATCHER_ADDR);
    hubEvmSpokeAggregateProposer = HubEvmSpokeAggregateProposer(HUB_EVM_AGG_PROPOSER_ADDR);
    hubSolanaMessageDispatcher = HubSolanaMessageDispatcher(HUB_SOLANA_DISPATCHER_ADDR);
    hubSolanaSpokeVoteDecoder = HubSolanaSpokeVoteDecoder(HUB_SOLANA_VOTE_DECODER_ADDR);
    testWToken = ERC20Votes(TEST_WTOKEN_ADDR);

    console.log("Hub Contracts Loaded on Mainnet Fork:");
    console.log("Timelock:", address(timelock));
    console.log("Governor:", address(gov));
    console.log("Extender:", address(extender));
    console.log("VotePool:", address(hubVotePool));
    console.log("Test WToken:", address(testWToken));
  }

  function testVerifyHubParameters() public {
    console.log("Verifying Hub Parameters (against DeployHubContractsTestMainnet.sol config)...");

    // Timelock
    assertEq(timelock.getMinDelay(), EXPECTED_MIN_DELAY, "Timelock minDelay mismatch");

    // Governor
    assertEq(gov.name(), EXPECTED_GOV_NAME, "Governor name mismatch");
    assertEq(address(gov.token()), TEST_WTOKEN_ADDR, "Governor token mismatch");
    assertEq(address(gov.timelock()), TIMELOCK_ADDR, "Governor timelock mismatch");
    assertEq(gov.votingDelay(), EXPECTED_VOTING_DELAY, "Governor votingDelay mismatch");
    assertEq(gov.votingPeriod(), EXPECTED_VOTING_PERIOD, "Governor votingPeriod mismatch");
    assertEq(gov.proposalThreshold(), EXPECTED_PROPOSAL_THRESHOLD, "Governor proposalThreshold mismatch");
    // Check the quorum using the current block's timestamp, which should reflect the initial value
    assertEq(gov.quorum(block.timestamp), EXPECTED_QUORUM, "Governor initialQuorum mismatch");

    assertEq(gov.hubVotePool(), HUB_VOTE_POOL_ADDR, "Governor hubVotePool mismatch");
    assertEq(gov.wormhole(), EXPECTED_WORMHOLE_CORE, "Governor wormholeCore mismatch");
    assertEq(gov.governorProposalExtender(), EXTENDER_ADDR, "Governor governorProposalExtender mismatch");
    assertEq(gov.voteWeightWindow(), EXPECTED_VOTE_WEIGHT_WINDOW, "Governor voteWeightWindow mismatch");

    // Extender
    // Verify against the *actual* deployer address
    assertEq(extender.voteExtenderAdmin(), actualDeployer, "Extender voteExtenderAdmin mismatch");
    assertEq(extender.voteTimeExtension(), EXPECTED_VOTE_TIME_EXTENSION, "Extender voteTimeExtension mismatch");
    assertEq(extender.minimumExtensionTime(), EXPECTED_MIN_EXTENSION_TIME, "Extender minimumExtensionTime mismatch");
    // Ownership check might be different depending on how it was deployed/transferred
    // assertEq(extender.owner(), actualDeployer, "Extender owner mismatch");
    console.log("WARN: Extender owner check might need adjustment based on deployment process.");

    // Vote Pool
    assertEq(hubVotePool.wormhole(), EXPECTED_WORMHOLE_CORE, "VotePool wormholeCore mismatch");
    assertEq(hubVotePool.governor(), GOV_ADDR, "VotePool governor mismatch");
    assertEq(hubVotePool.owner(), actualDeployer, "VotePool owner mismatch");

    // Proposal Metadata
    assertEq(hubProposalMetadata.governor(), GOV_ADDR, "Metadata governor mismatch");

    // Message Dispatcher (EVM)
    // assertEq(hubMessageDispatcher.timelock(), TIMELOCK_ADDR, "EvmDispatcher timelock mismatch"); // Invalid check
    assertEq(hubMessageDispatcher.wormhole(), EXPECTED_WORMHOLE_CORE, "EvmDispatcher wormholeCore mismatch");
    assertEq(
      hubMessageDispatcher.consistencyLevel(), EXPECTED_CONSISTENCY_LEVEL, "EvmDispatcher consistencyLevel mismatch"
    );
    assertEq(hubMessageDispatcher.owner(), actualDeployer, "EvmDispatcher owner mismatch");

    // Message Dispatcher (Solana)
    // assertEq(hubSolanaMessageDispatcher.timelock(), TIMELOCK_ADDR, "SolanaDispatcher timelock mismatch"); // Invalid
    // check
    assertEq(hubSolanaMessageDispatcher.wormhole(), EXPECTED_WORMHOLE_CORE, "SolanaDispatcher wormholeCore mismatch");
    assertEq(
      hubSolanaMessageDispatcher.consistencyLevel(),
      EXPECTED_CONSISTENCY_LEVEL,
      "SolanaDispatcher consistencyLevel mismatch"
    );
    assertEq(hubSolanaMessageDispatcher.owner(), actualDeployer, "SolanaDispatcher owner mismatch");

    // EVM Aggregate Proposer
    assertEq(hubEvmSpokeAggregateProposer.wormhole(), EXPECTED_WORMHOLE_CORE, "EvmAggProposer wormholeCore mismatch");
    assertEq(hubEvmSpokeAggregateProposer.governor(), GOV_ADDR, "EvmAggProposer governor mismatch");
    assertEq(
      hubEvmSpokeAggregateProposer.maxQueryTimestampOffset(),
      EXPECTED_MAX_QUERY_OFFSET,
      "EvmAggProposer maxQueryTimestampOffset mismatch"
    );

    // Solana Vote Decoder
    assertEq(hubSolanaSpokeVoteDecoder.wormhole(), EXPECTED_WORMHOLE_CORE, "SolanaDecoder wormholeCore mismatch");
    assertEq(address(hubSolanaSpokeVoteDecoder.HUB_VOTE_POOL()), HUB_VOTE_POOL_ADDR, "SolanaDecoder target mismatch");
    assertEq(
      hubSolanaSpokeVoteDecoder.SOLANA_TOKEN_DECIMALS(),
      EXPECTED_SOLANA_DECIMALS,
      "SolanaDecoder tokenDecimals mismatch"
    );
    // Check Solana query type registration
    assertEq(hubVotePool.registeredQueryTypes(5), HUB_SOLANA_VOTE_DECODER_ADDR, "SolanaDecoder query type mismatch");

    console.log("Hub Parameter Verification Complete.");
  }

  function testVerifyHubRoles() public {
    console.log("Verifying Hub Roles (Final Config)...");

    // Timelock roles granted to Governor
    assertTrue(timelock.hasRole(PROPOSER_ROLE, GOV_ADDR), "Governor lacks PROPOSER_ROLE");
    assertTrue(timelock.hasRole(EXECUTOR_ROLE, GOV_ADDR), "Governor lacks EXECUTOR_ROLE");
    assertTrue(timelock.hasRole(CANCELLER_ROLE, GOV_ADDR), "Governor lacks CANCELLER_ROLE");

    // Timelock admin role handling - verify against the *actual* deployer
    assertFalse(timelock.hasRole(TIMELOCK_ADMIN_ROLE, actualDeployer), "Deployer still has TIMELOCK_ADMIN_ROLE");
    assertTrue(timelock.hasRole(TIMELOCK_ADMIN_ROLE, TIMELOCK_ADDR), "Timelock lacks TIMELOCK_ADMIN_ROLE");

    // Extender admin (should be actual deployer in this test config)
    // NOTE: For production verification, this should check against the Foundation Multisig address.
    assertEq(extender.voteExtenderAdmin(), actualDeployer, "Extender admin mismatch");

    // Extender owner (Set to Timelock during Hub deployment)
    assertEq(extender.owner(), TIMELOCK_ADDR, "Extender owner mismatch");

    // Governor proposer role check (for EVM Aggregate Proposer)
    // Verify against the intended final state after setup
    assertEq(gov.whitelistedProposer(), HUB_EVM_AGG_PROPOSER_ADDR, "EvmAggProposer is not whitelisted");

    // Spoke registration status in VotePool (Final Config)
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

    // Other ownership checks (assuming deployer retains ownership initially)
    assertEq(gov.owner(), actualDeployer, "Governor owner mismatch");
    assertEq(hubEvmSpokeAggregateProposer.owner(), actualDeployer, "EvmAggProposer owner mismatch");

    console.log("Hub Role Verification Complete.");
  }

  function testCanProposeOnHub() public {
    console.log("Testing Hub Proposal Creation...");

    // Use the deployer address as the proposer for this test
    address proposer = actualDeployer;
    uint256 proposalThreshold = EXPECTED_PROPOSAL_THRESHOLD;

    // 1. Ensure proposer has enough tokens and delegates
    uint256 currentBalance = testWToken.balanceOf(proposer);
    console.log("Proposer WToken Balance:", currentBalance);
    require(currentBalance >= proposalThreshold, "FAIL: Proposer lacks sufficient balance on fork");

    vm.prank(proposer);
    testWToken.delegate(proposer);
    console.log("Proposer delegated votes to self.");

    // Ensure delegation is registered (votes are available at next block)
    vm.roll(block.number + 1);
    assertGe(testWToken.getVotes(proposer), proposalThreshold, "Proposer votes below threshold after delegation");

    // 2. Warp time past voting delay
    uint48 votingDelay = EXPECTED_VOTING_DELAY;
    vm.warp(block.timestamp + votingDelay + 1);
    console.log("Warped time past voting delay.");

    // 3. Prepare proposal details
    address[] memory targets = new address[](1);
    targets[0] = address(testWToken); // Example: Target the token contract
    uint256[] memory values = new uint256[](1);
    values[0] = 0; // No ETH value
    bytes[] memory calldatas = new bytes[](1);
    calldatas[0] = abi.encodeWithSignature("approve(address,uint256)", address(gov), 0); // Example: Approve gov for 0
    string memory description = "Test Proposal: Verify Hub Proposal Creation";
    bytes32 descriptionHash = keccak256(bytes(description));

    // 4. Propose
    console.log("Submitting proposal...");
    vm.prank(proposer);
    uint256 proposalId = gov.propose(targets, values, calldatas, description);

    // 5. Verify proposal state
    assertTrue(proposalId != 0, "Proposal ID is zero");
    console.log("Proposal Created with ID:", proposalId);

    // Proposal state should be Active immediately after the voting delay period starts
    assertEq(uint8(gov.state(proposalId)), uint8(Governor.ProposalState.Active), "Proposal not Active");
    console.log("Proposal state verified as Active.");

    // Optional: Verify proposal details stored in Governor
    (uint256 voteStart, uint256 voteEnd) = gov.proposalSnapshot(proposalId);
    assertTrue(voteStart > 0, "Proposal snapshot start is zero");
    assertTrue(voteEnd > voteStart, "Proposal snapshot end not after start");

    console.log("Hub Proposal Creation Test Complete.");
  }

  // TODO: testProposerCanCancel
  // TODO: testCanExtendProposal
}
