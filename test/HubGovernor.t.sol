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

contract HubGovernorTest is Test, ProposalTest {
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

  function _mintAndDelegate(address user, uint256 _amount) public returns (address) {
    token.mint(user, _amount);
    vm.prank(user);
    token.delegate(user);
    return user;
  }

  function _setupDelegate() public returns (address[] memory) {
    address delegate = makeAddr("delegate");
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
    vm.warp(block.timestamp + 7 days);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, _callData);
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

contract EnableTrustedVotingAddress is HubGovernorTest {
  function _createEnableTrustedAddressProposal(address _trustedAddress) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("enableTrustedVotingAddress(address)", _trustedAddress));
  }

  function testFuzz_SetANewTrustedVoteAddress(address _trustedAddress, string memory _proposalDescription) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createEnableTrustedAddressProposal(_trustedAddress);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    assertEq(governor.trustedVotingAddresses(_trustedAddress), true);
  }

  function testFuzz_SetMultipleTrustedVoteAddresses(
    address _firstTrustedAddress,
    address _secondTrustedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_firstTrustedAddress != address(0) && _secondTrustedAddress != address(0));
    vm.assume(_firstTrustedAddress != address(timelock) && _secondTrustedAddress != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createEnableTrustedAddressProposal(_firstTrustedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );
    ProposalBuilder secondBuilder = _createEnableTrustedAddressProposal(_secondTrustedAddress);
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );

    assertEq(governor.trustedVotingAddresses(_firstTrustedAddress), true);
    assertEq(governor.trustedVotingAddresses(_secondTrustedAddress), true);
  }

  function testFuzz_EnableThenDisableTrustedAddress(
    address _trustedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond,
    string memory _proposalDescriptionThird
  ) public {
    vm.assume(keccak256(bytes(_proposalDescriptionFirst)) != keccak256(bytes(_proposalDescriptionThird)));
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createEnableTrustedAddressProposal(_trustedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );
    assertEq(governor.trustedVotingAddresses(_trustedAddress), true);

    ProposalBuilder secondBuilder = new ProposalBuilder();
    secondBuilder.push(
      address(governor), 0, abi.encodeWithSignature("disableTrustedVotingAddress(address)", _trustedAddress)
    );
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );
    assertEq(governor.trustedVotingAddresses(_trustedAddress), false);

    ProposalBuilder thirdBuilder = _createEnableTrustedAddressProposal(_trustedAddress);
    _queueAndVoteAndExecuteProposal(
      thirdBuilder.targets(), thirdBuilder.values(), thirdBuilder.calldatas(), _proposalDescriptionThird
    );

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

contract DisableTrustedVotingAddress is HubGovernorTest {
  function _createDisableTrustedVotingAddressProposal(address _trustedAddress) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("disableTrustedVotingAddress(address)", _trustedAddress));
  }

  function testFuzz_DisableTrustedAddress(address _trustedAddress, string memory _proposalDescription) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));

    governor.exposed_enableTrustedAddress(_trustedAddress);
    assertEq(governor.trustedVotingAddresses(_trustedAddress), true);

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createDisableTrustedVotingAddressProposal(_trustedAddress);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    assertEq(governor.trustedVotingAddresses(_trustedAddress), false);
  }

  function testFuzz_DisableMultipleAddresses(
    address _firstTrustedAddress,
    address _secondTrustedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_firstTrustedAddress != address(0) && _secondTrustedAddress != address(0));

    governor.exposed_enableTrustedAddress(_firstTrustedAddress);
    governor.exposed_enableTrustedAddress(_secondTrustedAddress);
    assertEq(governor.trustedVotingAddresses(_firstTrustedAddress), true);
    assertEq(governor.trustedVotingAddresses(_secondTrustedAddress), true);

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createDisableTrustedVotingAddressProposal(_firstTrustedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );

    ProposalBuilder secondBuilder = _createDisableTrustedVotingAddressProposal(_secondTrustedAddress);
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );

    assertEq(governor.trustedVotingAddresses(_firstTrustedAddress), false);
    assertEq(governor.trustedVotingAddresses(_secondTrustedAddress), false);
  }

  function testFuzz_DisableThenEnableTrustedAddress(
    address _trustedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_trustedAddress != address(0));
    vm.assume(_trustedAddress != address(timelock));

    governor.exposed_enableTrustedAddress(_trustedAddress);

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createDisableTrustedVotingAddressProposal(_trustedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );

    ProposalBuilder secondBuilder = new ProposalBuilder();
    secondBuilder.push(
      address(governor), 0, abi.encodeWithSignature("enableTrustedVotingAddress(address)", _trustedAddress)
    );
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );

    assertEq(governor.trustedVotingAddresses(_trustedAddress), true);
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

contract _CountVote is HubGovernorTest {
  function testFuzz_WhitelistedAddressCanVote(
    uint8 _support,
    uint32 _forVotes,
    uint32 _againstVotes,
    uint32 _abstainVotes,
    string memory _proposalDescription
  ) public {
    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
    _support = uint8(bound(_support, 0, 2));

    (, delegates) = _setGovernorAndDelegates();
    (ProposalBuilder builder) = _createArbitraryProposal();

    vm.startPrank(delegates[0]);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
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
    uint32 _abstainVotes,
    string memory _proposalDescription
  ) public {
    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
    vm.assume(_nonWhitelistedAddress != address(hubVotePool));
    _support = uint8(bound(_support, 0, 2));

    (, delegates) = _setGovernorAndDelegates();
    (ProposalBuilder builder) = _createArbitraryProposal();

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
    vm.assume(_nonWhitelistedAddress != address(hubVotePool));

    (, delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(delegates[0]);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    vm.stopPrank();

    _jumpToActiveProposal(_proposalId);

    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));
    vm.expectRevert("GovernorCountingFractional: no weight");
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
    vm.assume(_nonWhitelistedAddress != address(hubVotePool));
    _support = uint8(bound(_support, 0, 2));

    uint256 _totalWeight = uint256(_forVotes) + _againstVotes + _abstainVotes;
    vm.assume(_totalWeight != 0);
    _secondCallTotalWeight = bound(_secondCallTotalWeight, 1, _totalWeight);
    bytes memory _voteData = abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes));

    token.mint(_nonWhitelistedAddress, governor.proposalThreshold());
    vm.prank(_nonWhitelistedAddress);
    token.delegate(_nonWhitelistedAddress);

    _setGovernor(governor);
    (ProposalBuilder builder) = _createArbitraryProposal();

    vm.startPrank(_nonWhitelistedAddress);
    uint256 _proposalId =
      governor.propose(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
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
