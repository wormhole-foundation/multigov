// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

import {GovernorSettableFixedQuorum} from "src/extensions/GovernorSettableFixedQuorum.sol";
import {GovernorSettableFixedQuorumFakeHarness} from "test/harnesses/GovernorSettableFixedQuorumFakeHarness.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";

contract GovernorSettableFixedQuorumTest is Test, ProposalTest {
  GovernorSettableFixedQuorumFakeHarness public governor;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  uint208 constant INITIAL_QUORUM = 100e18;

  function setUp() public {
    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();
    governor = new GovernorSettableFixedQuorumFakeHarness("Example Gov", token, timelock, INITIAL_QUORUM);

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(governor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(governor));
  }

  function _mintAndDelegate(address user, uint256 _amount) public returns (address) {
    token.mint(user, _amount);
    vm.prank(user);
    token.delegate(user);
    return user;
  }

  function _setupDelegate() public returns (address[] memory) {
    address delegate = makeAddr("delegate");
    address[] memory delegates = new address[](1);
    delegates[0] = _mintAndDelegate(delegate, INITIAL_QUORUM);
    return delegates;
  }

  function _setGovernorAndDelegates() public returns (GovernorSettableFixedQuorumFakeHarness, address[] memory) {
    _setGovernor(governor);
    address[] memory delegates = _setupDelegate();
    _setDelegates(delegates);
    return (governor, delegates);
  }

  function _createProposal(bytes memory _callData) public returns (ProposalBuilder) {
    // Warp to ensure we don't overlap with any minting and delegation
    vm.warp(block.timestamp + 7 days);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, _callData);
    return builder;
  }
}

contract Quorum is GovernorSettableFixedQuorumTest {
  function testFuzz_SuccessfullyGetLatestQuorumCheckpoint(uint208 _quorum, uint256 _futureTimestamp) public {
    governor.exposed_setQuorum(_quorum);
    uint256 quorum = governor.quorum(block.timestamp);
    assertEq(quorum, _quorum);

    _futureTimestamp = bound(_futureTimestamp, block.timestamp + 1, type(uint48).max);
    vm.warp(_futureTimestamp);
    quorum = governor.quorum(block.timestamp);
    assertEq(quorum, _quorum);
  }
}

contract SetQuorum is GovernorSettableFixedQuorumTest {
  function _createSetQuorumProposal(uint208 _quorum) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", _quorum));
  }

  function testFuzz_CorrectlySetQuorumCheckpoint(uint208 _quorum, string memory _proposalDescription) public {
    _setGovernorAndDelegates();
    vm.warp(block.timestamp + 7 days);
    ProposalBuilder builder = _createSetQuorumProposal(_quorum);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    assertEq(governor.quorum(block.timestamp), _quorum);
  }

  function testFuzz_SetMultipleQuorumValues(
    uint208 _firstQuorum,
    uint208 _secondQuorum,
    uint256 _proposalDescriptionFirst,
    uint256 _proposalDescriptionSecond
  ) public {
    vm.assume(_proposalDescriptionFirst != _proposalDescriptionSecond);
    // Quorum values must be uint128 because of the way _countVotes is implemented to handle overflow
    _firstQuorum = uint128(bound(_firstQuorum, 0, type(uint128).max - 1));
    _secondQuorum = uint128(bound(_secondQuorum, 0, type(uint128).max - 1));

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createSetQuorumProposal(_firstQuorum);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), vm.toString(_proposalDescriptionFirst)
    );

    uint256 betweenProposalsTimestamp = uint256(block.timestamp + 1);
    assertEq(governor.quorum(betweenProposalsTimestamp), _firstQuorum);
    ProposalBuilder secondBuilder = _createSetQuorumProposal(_secondQuorum);
    _mintAndDelegate(delegates[0], _firstQuorum);

    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(),
      secondBuilder.values(),
      secondBuilder.calldatas(),
      vm.toString(_proposalDescriptionSecond)
    );

    assertEq(governor.quorum(block.timestamp), _secondQuorum);
    assertEq(governor.quorum(block.timestamp - 2), _firstQuorum);
  }

  function testFuzz_EmitsQuorumUpdatedEvent(uint208 _quorum, string memory _proposalDescription) public {
    _setGovernorAndDelegates();

    ProposalBuilder builder = _createSetQuorumProposal(_quorum);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(delegates[0]);
    uint256 _proposalId = governor.propose(targets, values, calldatas, _proposalDescription);

    _jumpToActiveProposal(_proposalId);

    _delegatesVote(_proposalId, 1);
    _jumpPastVoteComplete(_proposalId);

    governor.queue(targets, values, calldatas, keccak256(bytes(_proposalDescription)));

    _jumpPastProposalEta(_proposalId);

    vm.expectEmit();
    emit GovernorSettableFixedQuorum.QuorumUpdated(governor.quorum(block.timestamp), _quorum);
    governor.execute(targets, values, calldatas, keccak256(bytes(_proposalDescription)));
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(uint208 _quorum, address _caller) public {
    // Timelock will trigger a different error
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setQuorum(_quorum);
  }
}
