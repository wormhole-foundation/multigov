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

  function _mintAndDelegate() public returns (address) {
    address delegate = makeAddr("delegate");
    token.mint(delegate, governor.proposalThreshold());
    vm.prank(delegate);
    token.delegate(delegate);
    return delegate;
  }

  // Create a proposal that can be voted on
  function _createProposal() public returns (ProposalBuilder, address) {
    address delegate = _mintAndDelegate();

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
  function _createProposal(address _trustedAddress) public returns (ProposalBuilder, address) {
    address delegate = _mintAndDelegate();

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, abi.encodeWithSignature("enableTrustedVotingAddress(address)", _trustedAddress));
    return (builder, delegate);
  }

  function testFuzz_SetANewTrustedVoteAddress(address _trustedAddress) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));
    (ProposalBuilder builder, address delegate) = _createProposal(_trustedAddress);

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
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

  function testFuzz_SetMultipleTrustedVoteAddresses(address _firstTrustedAddress, address _secondTrustedAddress) public {
    vm.assume(_firstTrustedAddress != address(0) && _secondTrustedAddress != address(0));
    vm.assume(_firstTrustedAddress != address(timelock) && _secondTrustedAddress != address(timelock));
    (ProposalBuilder firstBuilder, address delegate) = _createProposal(_firstTrustedAddress);
    (ProposalBuilder secondBuilder,) = _createProposal(_secondTrustedAddress);

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;
    _setGovernor(governor);
    _setDelegates(delegates);
    _queueAndVoteAndExecuteProposal(firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), "Hi", 1);
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), "Hi 2", 1
    );

    assertEq(governor.trustedVotingAddresses(_firstTrustedAddress), true);
    assertEq(governor.trustedVotingAddresses(_secondTrustedAddress), true);
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

  function testFuzz_DisableMultipleAddresses(address _firstTrustedAddress, address _secondTrustedAddress) public {
    vm.assume(_firstTrustedAddress != address(0) && _secondTrustedAddress != address(0));

    governor.exposed_enableTrustedAddress(_firstTrustedAddress);
    governor.exposed_enableTrustedAddress(_secondTrustedAddress);
    assertEq(governor.trustedVotingAddresses(_firstTrustedAddress), true);
    assertEq(governor.trustedVotingAddresses(_secondTrustedAddress), true);

    address delegate = _mintAndDelegate();

    vm.warp(block.timestamp + 7 days);
    address[] memory delegates = new address[](1);
    delegates[0] = delegate;

    _setGovernor(governor);
    _setDelegates(delegates);

    ProposalBuilder firstBuilder = new ProposalBuilder();
    firstBuilder.push(
      address(governor), 0, abi.encodeWithSignature("disableTrustedVotingAddress(address)", _firstTrustedAddress)
    );
    _queueAndVoteAndExecuteProposal(firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), "Hi", 1);

    ProposalBuilder secondBuilder = new ProposalBuilder();
    secondBuilder.push(
      address(governor), 0, abi.encodeWithSignature("disableTrustedVotingAddress(address)", _secondTrustedAddress)
    );
    _queueAndVoteAndExecuteProposal(secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), "Hi", 1);

    assertEq(governor.trustedVotingAddresses(_firstTrustedAddress), false);
    assertEq(governor.trustedVotingAddresses(_secondTrustedAddress), false);
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
    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
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
    governor.exposed_countVote(_proposalId, address(hubVotePool), _support, _totalWeight, voteData);

    uint256 votingWeight = token.getVotes(address(hubVotePool));

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(_proposalId);
    assertEq(votingWeight, 0);
    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }

  function testFuzz_NonWhitelistedAddressCanVote(
    address _nonWhitelistedAddress,
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes
  ) public {
    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
    vm.assume(_nonWhitelistedAddress != address(hubVotePool));
    _support = uint8(bound(_support, 0, 2));

    (ProposalBuilder builder, address delegate) = _createProposal();
    _setGovernor(governor);

    vm.startPrank(delegate);
    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    governor.exposed_countVote(_proposalId, _nonWhitelistedAddress, _support, _totalWeight, _voteData);

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(_proposalId);

    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }

  function test_RevertIf_NonWhitelistedAddressTotalWeightIsZero(
    address _nonWhitelistedAddress,
    uint8 support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes
  ) public {
    vm.assume(_nonWhitelistedAddress != address(0));
    _setGovernor(governor);
    (ProposalBuilder builder, address delegate) = _createProposal();

    vm.startPrank(delegate);
    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    vm.expectRevert("GovernorCountingFractional: no weight");
    governor.exposed_countVote(_proposalId, _nonWhitelistedAddress, support, 0, _voteData);
  }

  function testFuzz_RevertIf_NonWhitelistedAddressHasAlreadyVotedWithItsWeight(
    address _nonWhitelistedAddress,
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    bytes memory _secondCallVoteData,
    uint256 _secondCallTotalWeight
  ) public {
    vm.assume(_nonWhitelistedAddress != address(0));
    vm.assume(_nonWhitelistedAddress != address(hubVotePool));
    _support = uint8(bound(_support, 0, 2));

    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    _secondCallTotalWeight = bound(_secondCallTotalWeight, 1, _totalWeight);
    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));

    token.mint(_nonWhitelistedAddress, _totalWeight);
    vm.prank(_nonWhitelistedAddress);
    token.delegate(_nonWhitelistedAddress);

    _setGovernor(governor);
    (ProposalBuilder builder, address delegate) = _createProposal();

    vm.startPrank(delegate);
    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    governor.exposed_countVote(_proposalId, _nonWhitelistedAddress, _support, _totalWeight, _voteData);

    // Cast another vote where the second call to _countVote uses a total weight that is less than or equal to the total
    // weight from the first call to _countVote
    vm.expectRevert("GovernorCountingFractional: all weight cast");
    governor.exposed_countVote(
      _proposalId, _nonWhitelistedAddress, _support, _secondCallTotalWeight, _secondCallVoteData
    );
  }
}
