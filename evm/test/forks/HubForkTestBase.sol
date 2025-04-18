// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
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
import {HubTestConstants} from "./HubTestConstants.sol";

// Base contract for Hub fork tests containing shared setup and helpers
abstract contract HubForkTestBase is Test, HubTestConstants {
  string internal ETHEREUM_RPC_URL = vm.envString("ETHEREUM_RPC_URL");
  uint256 internal ethereumForkId;
  address internal actualDeployer = 0x4135270D8bcF6b654e1169efEFc317aFA8778A83;

  address public PROPOSER_ADDRESS = 0x71CB1dc5AE0389F1828a5dFefB8476bd3BEA2AF2; // Dan Reecer
  address public EXPECTED_EXTENDER_ADMIN = actualDeployer;

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
  ERC20Votes internal wToken;

  // --- Setup --- (Common setup logic)
  function setUp() public virtual {
    ethereumForkId = vm.createSelectFork(ETHEREUM_RPC_URL, 22_297_427);

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

  // --- Helper Functions ---

  function _setupProposerAndDelegate(address _proposer) internal {
    uint256 proposalThreshold = EXPECTED_PROPOSAL_THRESHOLD;
    vm.prank(_proposer);
    wToken.delegate(_proposer);
    vm.roll(block.number + 1);
    assertGe(wToken.getVotes(_proposer), proposalThreshold, "Proposer votes below threshold after delegation");
  }

  function _prepareSimpleProposalData(string memory _description)
    internal
    view
    returns (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
  {
    targets = new address[](1);
    targets[0] = address(wToken);
    values = new uint256[](1);
    values[0] = 0;
    calldatas = new bytes[](1);
    calldatas[0] = abi.encodeWithSignature("approve(address,uint256)", address(gov), 0);
    descriptionHash = keccak256(bytes(_description));
  }

  function _proposeFrom(
    address _proposer,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description
  ) internal returns (uint256 proposalId) {
    vm.prank(_proposer);
    proposalId = gov.propose(_targets, _values, _calldatas, _description);
    assertTrue(proposalId != 0, "Proposal ID is zero");
  }
}
