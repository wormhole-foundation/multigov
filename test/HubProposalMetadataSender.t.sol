// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/Governor.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {HubProposalMetadataSender} from "src/HubProposalMetadataSender.sol";

import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {GovernorVoteFake} from "test/fakes/GovernorVoteFake.sol";
import {TestConstants} from "test/TestConstants.sol";

contract HubProposalMetadataSenderTest is Test, TestConstants {
  HubProposalMetadataSender hubProposalMetadataSender;
  SpokeMetadataCollector spokeMetadataCollector;
  ERC20VotesFake hubGovernorToken;
  IGovernor governor;
  IWormhole wormhole;

  // event ProposalMetadataBridged(uint256 indexed proposalId, uint256 voteStart, uint256 voteEnd, bool isCanceled);

  function setUp() public {
    vm.createSelectFork(vm.rpcUrl("mainnet"));
    hubGovernorToken = new ERC20VotesFake();
    governor = new GovernorVoteFake("Test Governor", hubGovernorToken);
    hubProposalMetadataSender = new HubProposalMetadataSender(address(governor), WORMHOLE_MAINNET_CORE_RELAYER);
    wormhole = IWormhole(WORMHOLE_MAINNET_CORE_RELAYER);
  }

  function _mintDelegateAndApprove() public {
    hubGovernorToken.mint(address(this), 1000);
    hubGovernorToken.approve(address(hubProposalMetadataSender), 1000);
    hubGovernorToken.delegate(address(this));
  }

  function _createProposal() public returns (uint256) {
    _mintDelegateAndApprove();
    return governor.propose(new address[](0), new uint256[](0), new bytes[](0), "Test Proposal");
  }

  function _createProposal(string memory _description) public returns (uint256) {
    _mintDelegateAndApprove();

    address[] memory targets = new address[](1);
    bytes[] memory calldatas = new bytes[](1);
    uint256[] memory values = new uint256[](1);

    bytes memory proposalCalldata = abi.encode(ERC20Mock.mint.selector, address(governor), 100_000);

    targets[0] = address(hubGovernorToken);
    calldatas[0] = proposalCalldata;
    values[0] = 0;
    return governor.propose(targets, values, calldatas, _description);
  }
}

contract Constructor is Test {
  function test_Correctly_set_args(address _governor, address _wormholeCore) public {
    HubProposalMetadataSender hubProposalMetadataSender = new HubProposalMetadataSender(_governor, _wormholeCore);
    assertEq(address(hubProposalMetadataSender.GOVERNOR()), _governor, "Governor is not set correctly");
    assertEq(address(hubProposalMetadataSender.WORMHOLE_CORE()), _wormholeCore, "Wormhole core is not set correctly");
  }
}

contract BridgeProposalMetadata is HubProposalMetadataSenderTest {
  event LogMessagePublished(
    address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel
  );
  event ProposalMetadataBridged(uint256 indexed proposalId, uint256 voteStart, uint256 voteEnd, bool isCanceled);

  function testFork_RevertIf_Proposal_invalid(uint256 _proposalId) public {
    vm.expectRevert(HubProposalMetadataSender.InvalidProposalId.selector);
    hubProposalMetadataSender.bridgeProposalMetadata(_proposalId);
  }

  // 1. Check for published event
  // 2. Check briged event
  function testFork_Proposal_message_successfully_published(string memory _description) public {
    vm.assume(keccak256(bytes("")) != keccak256(bytes(_description)));
    uint256 _proposalId = _createProposal(_description);

    uint256 _voteStart = governor.proposalSnapshot(_proposalId);
    uint256 _voteEnd = governor.proposalDeadline(_proposalId);
    uint64 sequence = wormhole.nextSequence(address(hubProposalMetadataSender));
    bytes memory _calldata = abi.encode(_proposalId, _voteStart, _voteEnd, false);

    vm.expectEmit();
    emit LogMessagePublished(address(hubProposalMetadataSender), 0, 0, _calldata, 201);

    vm.expectEmit();
    emit ProposalMetadataBridged(_proposalId, _voteStart, _voteEnd, false);

    // expect LogPublished first
    hubProposalMetadataSender.bridgeProposalMetadata(_proposalId);
  }
}
