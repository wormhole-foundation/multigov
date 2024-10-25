// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernorMinimumWeightedVoteWindow} from "src/extensions/GovernorMinimumWeightedVoteWindow.sol";
import {GovernorCountingFractional} from "src/lib/GovernorCountingFractional.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {HubVotePoolHarness} from "test/harnesses/HubVotePoolHarness.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";

contract HubGovernorTest is WormholeEthQueryTest, ProposalTest {
  HubGovernorHarness public governor;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubVotePoolHarness public hubVotePool;
  HubProposalExtender public extender;

  address initialOwner;

  uint48 constant VOTE_WEIGHT_WINDOW = 1 days;
  uint48 constant MINIMUM_VOTE_EXTENSION = 1 hours;
  uint48 constant VOTE_TIME_EXTENSION = 1 days;

  function setUp() public virtual {
    _setupWormhole();
    initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();
    extender = new HubProposalExtender(
      initialOwner, VOTE_TIME_EXTENSION, address(timelock), initialOwner, MINIMUM_VOTE_EXTENSION
    );

    hubVotePool = new HubVotePoolHarness(address(wormhole), initialOwner, address(timelock));

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: "Example Gov",
      token: token,
      timelock: timelock,
      initialVotingDelay: 1 days,
      initialVotingPeriod: 3 days,
      initialProposalThreshold: 500_000e18,
      initialQuorum: 100e18,
      hubVotePool: address(timelock),
      wormholeCore: address(wormhole),
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: VOTE_WEIGHT_WINDOW
    });

    governor = new HubGovernorHarness(params);

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(governor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(governor));

    vm.prank(address(timelock));
    hubVotePool.setGovernor(address(governor));

    vm.prank(initialOwner);
    extender.initialize(payable(governor));
  }

  function _mintAndDelegate(address user, uint256 _amount) public returns (address) {
    token.mint(user, _amount);
    vm.prank(user);
    token.delegate(user);
    vm.warp(vm.getBlockTimestamp() + 1);
    return user;
  }

  function _setupDelegate() public returns (address[] memory) {
    address delegate = makeAddr("delegate");
    address[] memory delegates = new address[](1);
    delegates[0] = _mintAndDelegate(delegate, governor.proposalThreshold());
    return delegates;
  }

  function _setupDelegate(address delegate) public returns (address[] memory) {
    address[] memory delegates = new address[](1);
    delegates[0] = _mintAndDelegate(delegate, governor.proposalThreshold());
    return delegates;
  }

  function _setGovernorAndDelegates() public returns (HubGovernorHarness, address[] memory) {
    _setGovernor(governor);
    address[] memory delegates = _setupDelegate();
    _setDelegates(delegates);
    return (governor, delegates);
  }

  // Creates a proposal using the currently set governor (HubGovernorHarness) as the target
  // Use the builder to then create a proposal
  function _createProposal(bytes memory _callData) public returns (ProposalBuilder) {
    // Warp to ensure we don't overlap with any minting and delegation
    vm.warp(vm.getBlockTimestamp() + 7 days);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, _callData);
    return builder;
  }

  function _createProposal(address _target, bytes memory _callData) public returns (ProposalBuilder) {
    // Warp to ensure we don't overlap with any minting and delegation
    vm.warp(vm.getBlockTimestamp() + 7 days);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(_target, 0, _callData);
    return builder;
  }

  // Create a proposal with arbitrary data
  function _createArbitraryProposal() public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", 100));
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
    address _deployer
  ) public {
    vm.assume(_initialVotingPeriod != 0);
    vm.assume(_timelock != address(0));
    HubProposalExtender _voteExtender =
      new HubProposalExtender(initialOwner, VOTE_TIME_EXTENSION, address(_timelock), _deployer, MINIMUM_VOTE_EXTENSION);

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: _name,
      token: ERC20Votes(_token),
      timelock: TimelockController(_timelock),
      initialVotingDelay: _initialVotingDelay,
      initialVotingPeriod: _initialVotingPeriod,
      initialProposalThreshold: _initialProposalThreshold,
      initialQuorum: _initialQuorum,
      hubVotePool: _timelock,
      wormholeCore: address(wormhole),
      governorProposalExtender: address(_voteExtender),
      initialVoteWeightWindow: 1 days
    });

    HubGovernor _governor = new HubGovernor(params);

    assertEq(_governor.name(), _name);
    assertEq(address(_governor.token()), _token);
    assertEq(address(_governor.timelock()), _timelock);
    assertEq(_governor.votingDelay(), _initialVotingDelay);
    assertEq(_governor.votingPeriod(), _initialVotingPeriod);
    assertEq(_governor.proposalThreshold(), _initialProposalThreshold);
    assertEq(address(_governor.HUB_PROPOSAL_EXTENDER()), address(_voteExtender));
    assertEq(_voteExtender.DEPLOYER(), _deployer);
    assertNotEq(address(_governor.hubVotePool(uint96(block.timestamp))), address(0));
  }

  function testFuzz_RevertIf_ExtenderOwnerIsNotTheTimelock(
    string memory _name,
    address _token,
    address payable _timelock,
    uint48 _initialVotingDelay,
    uint32 _initialVotingPeriod,
    uint208 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _extenderOwner,
    address _deployer
  ) public {
    vm.assume(_initialVotingPeriod != 0);
    vm.assume(_extenderOwner != address(0) && _timelock != address(0));
    vm.assume(_extenderOwner != address(_timelock));
    HubProposalExtender _voteExtender = new HubProposalExtender(
      initialOwner, VOTE_TIME_EXTENSION, address(_extenderOwner), _deployer, MINIMUM_VOTE_EXTENSION
    );

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: _name,
      token: ERC20Votes(_token),
      timelock: TimelockController(_timelock),
      initialVotingDelay: _initialVotingDelay,
      initialVotingPeriod: _initialVotingPeriod,
      initialProposalThreshold: _initialProposalThreshold,
      initialQuorum: _initialQuorum,
      hubVotePool: _timelock,
      wormholeCore: address(wormhole),
      governorProposalExtender: address(_voteExtender),
      initialVoteWeightWindow: 1 days
    });

    vm.expectRevert(HubGovernor.InvalidProposalExtender.selector);
    new HubGovernor(params);
  }

  function testFuzz_RevertIf_HubProposalExtenderIsEOA(
    string memory _name,
    address _token,
    address payable _timelock,
    uint48 _initialVotingDelay,
    uint32 _initialVotingPeriod,
    uint208 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _voteExtender
  ) public {
    vm.assume(_initialVotingPeriod != 0);
    vm.assume(_voteExtender.code.length == 0);
    vm.assume(_timelock != address(0));

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: _name,
      token: ERC20Votes(_token),
      timelock: TimelockController(_timelock),
      initialVotingDelay: _initialVotingDelay,
      initialVotingPeriod: _initialVotingPeriod,
      initialProposalThreshold: _initialProposalThreshold,
      initialQuorum: _initialQuorum,
      hubVotePool: _timelock,
      wormholeCore: address(wormhole),
      governorProposalExtender: _voteExtender,
      initialVoteWeightWindow: 1 days
    });

    vm.expectRevert(HubGovernor.InvalidProposalExtender.selector);
    new HubGovernor(params);
  }

  function testFuzz_RevertIf_VotingPeriodIsZero(
    string memory _name,
    address _token,
    address payable _timelock,
    uint48 _initialVotingDelay,
    uint208 _initialProposalThreshold,
    uint208 _initialQuorum,
    address _voteExtender
  ) public {
    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: _name,
      token: ERC20Votes(_token),
      timelock: TimelockController(_timelock),
      initialVotingDelay: _initialVotingDelay,
      initialVotingPeriod: 0,
      initialProposalThreshold: _initialProposalThreshold,
      initialQuorum: _initialQuorum,
      hubVotePool: _timelock,
      wormholeCore: address(wormhole),
      governorProposalExtender: _voteExtender,
      initialVoteWeightWindow: 1 days
    });

    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorInvalidVotingPeriod.selector, 0));
    new HubGovernor(params);
  }
}

contract SetHubVotePool is HubGovernorTest {
  function _createHubVotePoolProposal(address _hubVotePool) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _hubVotePool));
  }

  function testFuzz_SetANewHubVoteAddress(address _hubVotePool, string memory _proposalDescription) public {
    vm.assume(_hubVotePool != address(0));
    vm.assume(_hubVotePool != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createHubVotePoolProposal(_hubVotePool);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);

    assertEq(address(governor.hubVotePool(uint96(block.timestamp))), _hubVotePool);
  }

  function testFuzz_SettingANewHubVotePoolEmitsAnEvent(address _hubVotePool, string memory _proposalDescription) public {
    vm.assume(_hubVotePool != address(0));
    vm.assume(_hubVotePool != address(timelock));

    (, address[] memory delegates) = _setGovernorAndDelegates();

    ProposalBuilder builder = _createHubVotePoolProposal(_hubVotePool);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    vm.prank(delegates[0]);
    uint256 proposalId = governor.propose(targets, values, calldatas, _proposalDescription);

    _jumpToActiveProposal(proposalId);

    _delegatesVote(proposalId, uint8(VoteType.For));
    _jumpPastVoteComplete(proposalId);

    governor.queue(targets, values, calldatas, keccak256(bytes(_proposalDescription)));

    _jumpPastProposalEta(proposalId);
    HubVotePool existingVotePool = governor.hubVotePool(uint96(vm.getBlockTimestamp()));
    vm.expectEmit();
    emit HubGovernor.HubVotePoolUpdated(address(existingVotePool), _hubVotePool);
    governor.execute(targets, values, calldatas, keccak256(bytes(_proposalDescription)));
  }

  function testFuzz_ChangeHubVotePoolMultipleTimes(
    address _newHubVotePool1,
    address _newHubVotePool2,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_newHubVotePool1 != address(0) && _newHubVotePool2 != address(0));
    vm.assume(_newHubVotePool1 != address(timelock) && _newHubVotePool2 != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createHubVotePoolProposal(_newHubVotePool1);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescriptionFirst);

    ProposalBuilder builder2 = _createHubVotePoolProposal(_newHubVotePool2);
    _queueAndVoteAndExecuteProposal(
      builder2.targets(), builder2.values(), builder2.calldatas(), _proposalDescriptionSecond
    );
    assertEq(address(governor.hubVotePool(uint96(block.timestamp))), _newHubVotePool2);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(address _hubVotePool, address _caller) public {
    vm.assume(_hubVotePool != address(0));
    vm.assume(_hubVotePool != address(timelock));
    vm.assume(_caller != address(timelock));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setHubVotePool(_hubVotePool);
  }
}

contract ProposalDeadline is HubGovernorTest {
  function _proposeNewGovernorProposalExtender(address _governorProposalExtender) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setGovernorProposalExtender(address)", _governorProposalExtender));
  }

  function testFuzz_DeadlineHasBeenExtended(address _extender, address _proposer) public {
    _setGovernorAndDelegates();
    governor.exposed_setWhitelistedProposer(_proposer);

    ProposalBuilder builder = _proposeNewGovernorProposalExtender(_extender);
    vm.startPrank(_proposer);
    uint256 proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    uint256 currentVoteEnd = _proposalDeadline(proposalId);
    vm.warp(currentVoteEnd - 1);

    vm.prank(initialOwner);
    extender.extendProposal(proposalId);

    uint256 deadline = governor.proposalDeadline(proposalId);
    assertEq(currentVoteEnd + VOTE_TIME_EXTENSION, deadline);
  }

  function testFuzz_ProposalHasNotBeenExtended(address _extender, address _proposer) public {
    vm.assume(_extender != address(extender));

    _setGovernorAndDelegates();
    governor.exposed_setWhitelistedProposer(_proposer);

    ProposalBuilder builder = _proposeNewGovernorProposalExtender(_extender);
    vm.startPrank(_proposer);
    uint256 proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    uint256 deadline = governor.proposalDeadline(proposalId);
    assertEq(governor.proposalSnapshot(proposalId) + governor.votingPeriod(), deadline);
  }
}

contract Propose is HubGovernorTest {
  function _createSetWhitelistedProposerProposal(address _newWhitelistedProposer) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setWhitelistedProposer(address)", _newWhitelistedProposer));
  }

  function testFuzz_WhitelistedProposerCanProposeWithoutMeetingProposalThreshold(
    address _whitelistedProposer,
    address _proposer,
    string memory _description
  ) public {
    vm.assume(_whitelistedProposer != address(0));
    ProposalBuilder builder = _createSetWhitelistedProposerProposal(_proposer);

    governor.exposed_setWhitelistedProposer(_whitelistedProposer);

    vm.startPrank(_whitelistedProposer);
    uint256 proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), _description);
    vm.stopPrank();

    uint256 voteStart = governor.proposalSnapshot(proposalId);
    assertEq(voteStart, vm.getBlockTimestamp() + governor.votingDelay());
  }

  function testFuzz_UnwhitelistedProposerCanProposeWhenMeetingProposalThreshold(
    address _whitelistedProposer,
    address _proposer,
    string memory _description
  ) public {
    vm.assume(_whitelistedProposer != address(0));
    vm.assume(_proposer != address(0));

    _setupDelegate(_proposer);
    ProposalBuilder builder = _createSetWhitelistedProposerProposal(_proposer);

    governor.exposed_setWhitelistedProposer(_whitelistedProposer);

    vm.startPrank(_proposer);
    uint256 proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), _description);
    vm.stopPrank();

    uint256 voteStart = governor.proposalSnapshot(proposalId);
    assertEq(voteStart, vm.getBlockTimestamp() + governor.votingDelay());
  }

  function testFuzz_RevertIf_UnwhitelistedProposerDoesNotMeetProposalThreshold(
    address _whitelistedProposer,
    address _proposer,
    string memory _description
  ) public {
    vm.assume(_whitelistedProposer != address(0) && _proposer != address(0));
    vm.assume(_whitelistedProposer != _proposer);
    ProposalBuilder builder = _createSetWhitelistedProposerProposal(_proposer);

    governor.exposed_setWhitelistedProposer(_whitelistedProposer);

    vm.startPrank(_proposer);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    vm.expectRevert(
      abi.encodeWithSelector(
        IGovernor.GovernorInsufficientProposerVotes.selector, _proposer, 0, governor.proposalThreshold()
      )
    );
    governor.propose(targets, values, calldatas, _description);
    vm.stopPrank();
  }

  function testFuzz_RevertIf_ProposalHasAnInvalidDescription(address _proposer, address _incorrectProposer) public {
    vm.assume(_proposer != _incorrectProposer);
    vm.assume(_proposer != address(0));
    ProposalBuilder builder = _createSetWhitelistedProposerProposal(_proposer);
    _setupDelegate(_proposer);

    vm.startPrank(_proposer);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorRestrictedProposer.selector, _proposer));
    governor.propose(targets, values, calldatas, string.concat("#proposer=", vm.toString(_incorrectProposer)));
    vm.stopPrank();
  }
}

contract Quorum is HubGovernorTest {
  function testFuzz_SuccessfullyGetLatestQuorumCheckpoint(uint208 _quorum) public {
    governor.exposed_setQuorum(_quorum);
    uint256 quorum = governor.quorum(vm.getBlockTimestamp());
    assertEq(quorum, _quorum);
  }
}

contract SetWhitelistedProposer is HubGovernorTest {
  function testFuzz_CorrectlySetNewWhitelistedProposer(address _proposer) public {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(vm.getBlockTimestamp() + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setWhitelistedProposer(address)", _proposer));
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    assertEq(governor.whitelistedProposer(), _proposer);
  }

  function testFuzz_EmitsWhitelistedProposerUpdated(address _proposer) public {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(vm.getBlockTimestamp() + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setWhitelistedProposer(address)", _proposer));
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    vm.prank(delegate);
    uint256 _proposalId = governor.propose(targets, values, calldatas, "Hi");

    IGovernor.ProposalState _state = governor.state(_proposalId);
    assertEq(uint8(_state), uint8(IGovernor.ProposalState.Pending));

    _jumpToActiveProposal(_proposalId);

    _delegatesVote(_proposalId, 1);
    _jumpPastVoteComplete(_proposalId);

    governor.queue(targets, values, calldatas, keccak256(bytes("Hi")));

    _jumpPastProposalEta(_proposalId);

    vm.expectEmit();
    emit HubGovernor.WhitelistedProposerUpdated(governor.whitelistedProposer(), _proposer);
    governor.execute(targets, values, calldatas, keccak256(bytes("Hi")));
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(address _proposer, address _caller) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setWhitelistedProposer(_proposer);
  }
}

contract SetQuorum is HubGovernorTest {
  function testFuzz_CorrectlySetQuorumCheckpoint(uint208 _quorum) public {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(vm.getBlockTimestamp() + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setQuorum(uint208)", _quorum));
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    assertEq(governor.quorum(vm.getBlockTimestamp()), _quorum);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(uint208 _quorum, address _caller) public {
    // Timelock will trigger a different error
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setQuorum(_quorum);
  }
}

// Change to handle proposal
contract SetVotingPeriod is HubGovernorTest {
  function _proposeNewVotingPeriod(uint32 _votingPeriod) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setVotingPeriod(uint32)", _votingPeriod));
  }

  function testFuzz_CorrectlySetNewVotingPeriodIfAboveExtenderMinimum(uint32 _newVotingPeriod) public {
    _newVotingPeriod = uint32(bound(_newVotingPeriod, MINIMUM_VOTE_EXTENSION, type(uint32).max));

    _setGovernorAndDelegates();
    ProposalBuilder builder = _proposeNewVotingPeriod(_newVotingPeriod);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    assertEq(governor.votingPeriod(), _newVotingPeriod);
  }

  function testFuzz_RevertIf_NewVotingPeriodIsLessThanTheMinimumExtensionTime(uint32 _newVotingPeriod) public {
    _newVotingPeriod = uint32(bound(_newVotingPeriod, 0, MINIMUM_VOTE_EXTENSION - 1));

    (, address[] memory delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _proposeNewVotingPeriod(_newVotingPeriod);
    address[] memory _targets = builder.targets();
    uint256[] memory _values = builder.values();
    bytes[] memory _calldatas = builder.calldatas();
    string memory _description = "Hi";
    vm.prank(delegates[0]);
    uint256 _proposalId = governor.propose(_targets, _values, _calldatas, _description);

    IGovernor.ProposalState _state = governor.state(_proposalId);
    assertEq(uint8(_state), uint8(IGovernor.ProposalState.Pending));

    _jumpToActiveProposal(_proposalId);

    _delegatesVote(_proposalId, uint8(VoteType.For));
    _jumpPastVoteComplete(_proposalId);

    governor.queue(_targets, _values, _calldatas, keccak256(bytes(_description)));

    _jumpPastProposalEta(_proposalId);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorInvalidVotingPeriod.selector, _newVotingPeriod));
    governor.execute(_targets, _values, _calldatas, keccak256(bytes(_description)));
  }
}

contract SetVoteWeightWindow is HubGovernorTest {
  function testFuzz_CorrectlyUpdateVoteWeightWindow(uint48 _window) public {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());

    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(vm.getBlockTimestamp() + VOTE_WEIGHT_WINDOW + 1);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setVoteWeightWindow(uint48)", _window));

    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    uint48 setWindow = governor.getVoteWeightWindowLength(uint48(block.timestamp));
    assertEq(setWindow, _window);
  }

  function testFuzz_UpdatingVoteWeightWindowEmitAnEvent(uint48 _window) public {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());

    vm.prank(delegate);
    token.delegate(delegate);

    vm.warp(vm.getBlockTimestamp() + VOTE_WEIGHT_WINDOW + 1);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("setVoteWeightWindow(uint48)", _window));

    address[] memory _targets = builder.targets();
    uint256[] memory _values = builder.values();
    bytes[] memory _calldatas = builder.calldatas();
    string memory _description = "Hi";

    _setGovernor(governor);

    vm.prank(delegate);
    uint256 _proposalId = governor.propose(_targets, _values, _calldatas, _description);

    _jumpToActiveProposal(_proposalId);

    vm.prank(delegate);
    governor.castVote(_proposalId, uint8(VoteType.For));
    _jumpPastVoteComplete(_proposalId);

    governor.queue(_targets, _values, _calldatas, keccak256(bytes(_description)));

    _jumpPastProposalEta(_proposalId);

    vm.expectEmit();
    emit GovernorMinimumWeightedVoteWindow.VoteWeightWindowUpdated(
      governor.getVoteWeightWindowLength(uint48(block.timestamp)), _window
    );
    governor.execute(_targets, _values, _calldatas, keccak256(bytes(_description)));
  }

  function testFuzz_RevertIf_NotCalledByOwner(address _caller, uint16 _window) public {
    vm.assume(_caller != address(governor));
    vm.assume(_caller != address(timelock));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setVoteWeightWindow(_window);
  }
}

contract _CountVote is HubGovernorTest {
  function testFuzz_WhitelistedAddressCanVoteWhenTotalWeightIsZero(
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    string memory _proposalDescription
  ) public {
    _support = uint8(bound(_support, 0, 2));

    (, delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(delegates[0]);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    governor.exposed_countVote(
      _proposalId, address(governor.hubVotePool(uint96(block.timestamp))), _support, 0, voteData
    );

    uint256 votingWeight = token.getVotes(address(governor.hubVotePool(uint96(block.timestamp))));

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(_proposalId);
    assertEq(votingWeight, 0);
    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }

  function testFuzz_WhitelistedAddressCanVoteWhenTotalWeightIsRandom(
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    uint128 _totalWeight,
    string memory _proposalDescription
  ) public {
    _support = uint8(bound(_support, 0, 2));

    _mintAndDelegate(address(governor.hubVotePool(uint96(block.timestamp))), _totalWeight);
    (, delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(delegates[0]);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    governor.exposed_countVote(
      _proposalId, address(governor.hubVotePool(uint96(block.timestamp))), _support, _totalWeight, voteData
    );

    uint256 votingWeight = token.getVotes(address(governor.hubVotePool(uint96(block.timestamp))));

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(_proposalId);
    assertEq(votingWeight, _totalWeight);
    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }

  function testFuzz_NonWhitelistedAddressCanVote(
    address _nonWhitelistedAddress,
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    string memory _proposalDescription
  ) public {
    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
    vm.assume(_nonWhitelistedAddress != address(hubVotePool));
    _support = uint8(bound(_support, 0, 2));

    (, delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(delegates[0]);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    governor.exposed_countVote(_proposalId, _nonWhitelistedAddress, _support, _totalWeight, _voteData);

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(_proposalId);

    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }

  function testFuzz_RevertIf_NonWhitelistedAddressTotalWeightIsZero(
    address _nonWhitelistedAddress,
    uint8 support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    string memory _proposalDescription
  ) public {
    uint256 ZERO_TOTAL_WEIGHT = 0;

    vm.assume(_nonWhitelistedAddress != address(0));
    vm.assume(_nonWhitelistedAddress != address(governor.hubVotePool(uint96(block.timestamp))));

    (, delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(delegates[0]);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    vm.expectRevert(GovernorCountingFractional.GovernorCountingFractional__NoVoteWeight.selector);
    governor.exposed_countVote(_proposalId, _nonWhitelistedAddress, support, ZERO_TOTAL_WEIGHT, _voteData);
  }

  function testFuzz_RevertIf_NonWhitelistedAddressHasAlreadyVotedWithItsWeight(
    address _nonWhitelistedAddress,
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    bytes memory _secondCallVoteData,
    uint256 _secondCallTotalWeight,
    string memory _proposalDescription
  ) public {
    vm.assume(_nonWhitelistedAddress != address(0));
    vm.assume(_nonWhitelistedAddress != address(governor.hubVotePool(uint96(block.timestamp))));
    _support = uint8(bound(_support, 0, 2));

    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
    _secondCallTotalWeight = bound(_secondCallTotalWeight, 1, _totalWeight);
    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));

    token.mint(_nonWhitelistedAddress, governor.proposalThreshold());
    vm.prank(_nonWhitelistedAddress);
    token.delegate(_nonWhitelistedAddress);

    _setGovernor(governor);
    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_nonWhitelistedAddress);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    governor.exposed_countVote(_proposalId, _nonWhitelistedAddress, _support, _totalWeight, _voteData);

    // Cast another vote where the second call to _countVote uses a total weight that is less than or equal to the total
    // weight from the first call to _countVote
    vm.expectRevert(GovernorCountingFractional.GovernorCountingFractional__VoteWeightExceeded.selector);
    governor.exposed_countVote(
      _proposalId, _nonWhitelistedAddress, _support, _secondCallTotalWeight, _secondCallVoteData
    );
  }
}

contract _GetVotes is HubGovernorTest {
  address attacker = makeAddr("Attacker");

  function _createIncreasingCheckpointArray(uint256 _checkpoints) public {
    vm.prank(attacker);
    token.delegate(attacker);
    vm.warp(1);
    for (uint256 i = 0; i < _checkpoints; i++) {
      vm.warp(vm.getBlockTimestamp() + 1);
      token.mint(attacker, uint256(100));
    }
  }

  function _createDecreasingCheckpointArray(uint256 _checkpoints) public {
    vm.prank(attacker);
    token.delegate(attacker);
    vm.warp(1);
    token.mint(attacker, uint256(100 * _checkpoints));
    for (uint256 i = 0; i < _checkpoints; i++) {
      vm.warp(vm.getBlockTimestamp() + 1);
      token.burn(attacker, uint256(100));
    }
  }

  function _createUniformCheckpointArray(uint256 _checkpoints) public {
    vm.prank(attacker);
    token.delegate(attacker);
    vm.warp(1);
    token.mint(attacker, uint256(100 * _checkpoints));
    for (uint256 i = 0; i < _checkpoints; i++) {
      vm.warp(vm.getBlockTimestamp() + 1);
    }
  }

  function _createAlternatingCheckpointArray(uint256 _checkpoints) public {
    vm.prank(attacker);
    token.delegate(attacker);
    vm.warp(1);
    for (uint256 i = 0; i < _checkpoints; i++) {
      vm.warp(vm.getBlockTimestamp() + 1);
      if (i % 2 == 0) token.mint(attacker, uint256(100 * _checkpoints));
      else token.burn(attacker, uint256(100 * _checkpoints));
    }
  }

  function testFuzz_GetCorrectVoteWeightWhenTheUserNoWeight(address _account, uint96 _windowStart) public view {
    _windowStart = uint96(bound(_windowStart, VOTE_WEIGHT_WINDOW, type(uint96).max));
    uint256 _votingWeight = governor.exposed_getVotes(_account, _windowStart);
    assertEq(_votingWeight, 0);
  }

  function testFuzz_RevertIf_WhenEarlierThanWindow(uint96 _start) public {
    uint48 WINDOW_LENGTH = 2;
    _start = uint96(bound(_start, 1, WINDOW_LENGTH - 1));

    vm.warp(1);
    governor.exposed_setVoteWeightWindow(WINDOW_LENGTH);
    _createIncreasingCheckpointArray(5);

    vm.expectRevert();
    governor.exposed_getVotes(attacker, _start);
  }

  function testFuzz_GetCorrectVoteWeightBeforeCheckpointsAreRecorded(uint48 _start) public {
    uint48 WINDOW_LENGTH = 2;
    _start = uint48(bound(_start, WINDOW_LENGTH, 3));
    governor.exposed_setVoteWeightWindow(WINDOW_LENGTH);
    _createIncreasingCheckpointArray(5);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 0);
  }

  function testFuzz_GetCorrectVoteWeightWhenItHasNIncreasingCheckpoints(uint48 _start) public {
    _start = uint48(bound(_start, 4, 1002));
    governor.exposed_setVoteWeightWindow(2);
    _createIncreasingCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, (_start - 3) * 100);
  }

  function testFuzz_GetCorrectVoteWeightWhenItHasNDecreasingCheckpoints(uint48 _start) public {
    _start = uint48(bound(_start, 4, 1000));
    governor.exposed_setVoteWeightWindow(2);
    _createDecreasingCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, (1000 * 100) - ((_start - 1) * 100));
  }

  function testFuzz_GetCorrectVoteWeightWhenItHasNUniformCheckpoints(uint256 _start) public {
    _start = bound(_start, 4, 1002);
    governor.exposed_setVoteWeightWindow(2);
    _createUniformCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_GetCorrectVoteWeightWhenItHasNAlternatingCheckpoints(uint256 _start) public {
    _start = bound(_start, 4, 1002);
    governor.exposed_setVoteWeightWindow(2);
    _createAlternatingCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 0);
  }

  function testFuzz_GetCorrectWeightAfterLastCheckpointIncreasingWeight(uint256 _start) public {
    _start = bound(_start, 1003, 10_000);
    governor.exposed_setVoteWeightWindow(2);
    _createIncreasingCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_GetCorrectWeightAfterLastCheckpointDecreasingWeight(uint256 _start) public {
    _start = bound(_start, 1001, 10_000);
    governor.exposed_setVoteWeightWindow(2);
    _createDecreasingCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 0);
  }

  function testFuzz_GetCorrectWeightAfterLastCheckpointUniformWeight(uint256 _start) public {
    _start = bound(_start, 1003, 10_000);
    governor.exposed_setVoteWeightWindow(2);
    _createUniformCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 1000 * 100);
  }

  function testFuzz_GetCorrectWeightAfterLastCheckpointAlternatingWeight(uint256 _start) public {
    _start = bound(_start, 1003, 10_000);
    governor.exposed_setVoteWeightWindow(2);
    _createAlternatingCheckpointArray(1000);
    uint256 _votes = governor.exposed_getVotes(attacker, _start);
    assertEq(_votes, 0);
  }
}
