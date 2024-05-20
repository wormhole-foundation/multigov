// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {WormholeMock} from "wormhole-solidity-sdk/testing/helpers/WormholeMock.sol";

import {HubGovernor} from "src/HubGovernor.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";

contract HubGovernorTest is Test {
  HubGovernorHarness public governor;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubVotePool public hubVotePool;
  WormholeMock public wormhole;

  function setUp() public {
    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();
    wormhole = new WormholeMock();
    hubVotePool = new HubVotePool(address(wormhole), initialOwner, new HubVotePool.SpokeVoteAggregator[](1));
    governor =
      new HubGovernorHarness("Example Gov", token, timelock, 1 days, 1 days, 500_000e18, 100e18, address(hubVotePool));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(governor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(governor));

    vm.prank(initialOwner);
    hubVotePool.transferOwnership(address(governor));
  }

  // Create a proposal that can be voted on
  function _createProposal() public returns (ProposalBuilder, address) {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setQuorum(uint208)", 100));
    return (builder, delegate);
  }
}

contract Constructor is HubGovernorTest {
  function testFuzz_CorrectlySetConstructorArgs(
    string memory _name,
    address _token,
    address payable _timelock,
    uint48 _initialVotingDelay,
    uint32 _initialVotingPeriod,
    uint208 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _hubVotePool
  ) public {
    vm.assume(_initialVotingPeriod != 0);

    HubGovernor _governor = new HubGovernor(
      _name,
      IVotes(_token),
      TimelockController(_timelock),
      _initialVotingDelay,
      _initialVotingPeriod,
      _initialProposalThreshold,
      _initialQuorum,
      _hubVotePool
    );

    assertEq(_governor.name(), _name);
    assertEq(address(_governor.token()), _token);
    assertEq(address(_governor.timelock()), _timelock);
    assertEq(_governor.votingDelay(), _initialVotingDelay);
    assertEq(_governor.votingPeriod(), _initialVotingPeriod);
    assertEq(_governor.proposalThreshold(), _initialProposalThreshold);
    assertEq(_governor.trustedVotingAddresses(_hubVotePool), true);
  }

  function testFuzz_RevertIf_VotingPeriodIsZero(
    string memory _name,
    address _token,
    address payable _timelock,
    uint48 _initialVotingDelay,
    uint208 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _hubVotePool
  ) public {
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorInvalidVotingPeriod.selector, 0));
    new HubGovernor(
      _name,
      IVotes(_token),
      TimelockController(_timelock),
      _initialVotingDelay,
      0,
      _initialProposalThreshold,
      _initialQuorum,
      _hubVotePool
    );
  }
}

contract EnableTrustedVotingAddress is HubGovernorTest, ProposalTest {
  function testFuzz_SetANewTrustedVoteAddress(address _trustedAddress) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("enableTrustedVotingAddress(address)", _trustedAddress));
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi", 1);
    assertEq(governor.trustedVotingAddresses(_trustedAddress), true);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(address _trustedAddress, address _caller) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));
    vm.assume(_caller != address(timelock));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.enableTrustedVotingAddress(_trustedAddress);
  }
}

contract DisableTrustedVotingAddress is HubGovernorTest, ProposalTest {
  function testFuzz_SetHubVotePool(address _trustedAddress) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));

    governor.exposed_enableTrustedAddress(_trustedAddress);
    assertEq(governor.trustedVotingAddresses(_trustedAddress), true);

    address delegate = makeAddr("delegate");
    console2.logUint(governor.proposalThreshold());
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("disableTrustedVotingAddress(address)", _trustedAddress));
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi", 1);
    assertEq(governor.trustedVotingAddresses(_trustedAddress), false);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(address _trustedAddress, address _caller) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));
    vm.assume(_caller != address(timelock));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.disableTrustedVotingAddress(_trustedAddress);
  }
}

contract Quorum is HubGovernorTest {
  function testFuzz_SuccessfullyGetLatestQuorumCheckpoint(uint208 _quorum) public {
    governor.exposed_setQuorum(_quorum);
    uint256 quorum = governor.quorum(block.timestamp);
    assertEq(quorum, _quorum);
  }
}

contract SetQuorum is HubGovernorTest, ProposalTest {
  function testFuzz_CorrectlySetQuorumCheckpoint(uint208 _quorum) public {
    address delegate = makeAddr("delegate");
    console2.logUint(governor.proposalThreshold());
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setQuorum(uint208)", _quorum));
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi", 1);
    assertEq(governor.quorum(block.timestamp), _quorum);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(uint208 _quorum, address _caller) public {
    // Timelock will trigger a different error
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setQuorum(_quorum);
  }
}

contract _CountVote is HubGovernorTest, ProposalTest {
  function testFuzz_WhitelistedAddressCanVote(
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes
  ) public {
    vm.assume(uint128(_againstVotes) + _forVotes + _abstainVotes != 0);
    _support = uint8(bound(_support, 0, 2));

    (ProposalBuilder builder, address delegate) = _createProposal();
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);

    vm.startPrank(delegate);
    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    governor.exposed_countVote(
      _proposalId, address(hubVotePool), _support, uint256(_forVotes) + _againstVotes + _abstainVotes, voteData
    );

    uint256 votingWeight = token.getVotes(address(hubVotePool));

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(_proposalId);
    assertEq(votingWeight, 0);
    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }
}

contract GetMinVotesInWindow is HubGovernorTest {
  address attacker = makeAddr("Attacker");

  function _createCheckpointArray() public {
    vm.prank(attacker);
    token.delegate(attacker);
    vm.warp(1);
    for (uint256 i = 0; i < 1000; i++) {
      vm.warp(block.timestamp + 1);
      token.mint(attacker, uint256(100));
    }
  }
  function _createCheckpointArray(uint256 _checkpoints) public {
    vm.prank(attacker);
    token.delegate(attacker);
    vm.warp(1);
    for (uint256 i = 0; i < _checkpoints; i++) {
      vm.warp(block.timestamp + 1);
      token.mint(attacker, uint256(100));
    }
  }
 
  // Assume 12 second block times
  function testFuzz_MainnetBest_OneMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetBest_OneMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetBest_OneMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetMid_OneMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(3);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetMid_OneMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(3);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetMid_OneMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(3);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetWorst_OneMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(5);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetWorst_OneMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(5);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetWorst_OneMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(5);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetBest_TenMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetBest_TenMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetBest_TenMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetMid_TenMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(25);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetMid_TenMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(25);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetMid_TenMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(25);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetWorst_TenMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(50);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetWorst_TenMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(50);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetWorst_TenMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(50);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetBest_ThirtyMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetBest_ThirtyMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_MainnetMid_ThirtyMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(75);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetMid_ThirtyMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(75);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetMid_ThirtyMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(75);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

 function testFuzz_MainnetWorst_ThirtyMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(150);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetWorst_ThirtyMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(150);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetWorst_ThirtyMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(150);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

 function testFuzz_MainnetMid_TwoHours_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(300);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetMid_TwoHours_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(300);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetMid_TwoHours_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(300);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

 function testFuzz_MainnetWorst_TwoHours_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(600);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_MainnetWorst_TwoHours_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(600);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_MainnetWorst_TwoHours_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(600);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }
  ///////////////////////////////////////////////////////////////////////
  function testFuzz_L2Best_OneMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Best_OneMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Best_OneMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Mid_OneMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(15);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Mid_OneMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(15);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Mid_OneMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(15);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Worst_OneMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(30);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Worst_OneMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(30);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Worst_OneMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(30);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Best_TenMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Best_TenMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Best_TenMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Mid_TenMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(150);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Mid_TenMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(150);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Mid_TenMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(150);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Worst_TenMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(300);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Worst_TenMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(300);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Worst_TenMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(300);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Best_ThirtyMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Best_ThirtyMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(2);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_L2Mid_ThirtyMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(450);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Mid_ThirtyMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(450);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Mid_ThirtyMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(450);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

 function testFuzz_L2Worst_ThirtyMinute_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(900);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Worst_ThirtyMinute_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(900);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Worst_ThirtyMinute_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(900);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

 function testFuzz_L2Mid_TwoHours_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray(3600);
	governor.setWeightCheckpoints(3600);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Mid_TwoHours_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray(3600);
	governor.setWeightCheckpoints(3600);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Mid_TwoHours_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray(3600);
	governor.setWeightCheckpoints(3600);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

 function testFuzz_L2Worst_TwoHours_GetMinVotesBeforeWindow(uint256 _start) public {
    _start = bound(_start, 0, 1);
    _createCheckpointArray();
	governor.setWeightCheckpoints(7200);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 0);
  }

  function testFuzz_L2Worst_TwoHours_GetMinVotesInWindow(uint256 _start) public {
    _start = bound(_start, 2, 1000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(7200);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, (_start - 1) * 100);
  }

  function testFuzz_L2Worst_TwoHours_GetMinVotesInWindowAboveCheckpoints(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    _createCheckpointArray();
	governor.setWeightCheckpoints(7200);
    uint256 _votes = governor.getMinVotesInWindow(_start, attacker);
    assertEq(_votes, 1000 * 100);
  }

}

