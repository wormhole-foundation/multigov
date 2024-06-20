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
    vm.warp(block.timestamp + 1);
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
    assertEq(_governor.whitelistedVotingAddresses(_hubVotePool), true);
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

contract EnableWhitelistedVotingAddress is HubGovernorTest {
  function _createEnableWhitelistedAddressProposal(address _whitelistedAddress) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("enableWhitelistedVotingAddress(address)", _whitelistedAddress));
  }

  function testFuzz_SetANewWhitelistedVoteAddress(address _whitelistedAddress, string memory _proposalDescription)
    public
  {
    vm.assume(_whitelistedAddress != address(0));
    vm.assume(_whitelistedAddress != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createEnableWhitelistedAddressProposal(_whitelistedAddress);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), true);
  }

  function testFuzz_SetMultipleWhitelistedVoteAddresses(
    address _firstWhitelistedAddress,
    address _secondWhitelistedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_firstWhitelistedAddress != address(0) && _secondWhitelistedAddress != address(0));
    vm.assume(_firstWhitelistedAddress != address(timelock) && _secondWhitelistedAddress != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createEnableWhitelistedAddressProposal(_firstWhitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );
    ProposalBuilder secondBuilder = _createEnableWhitelistedAddressProposal(_secondWhitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );

    assertEq(governor.whitelistedVotingAddresses(_firstWhitelistedAddress), true);
    assertEq(governor.whitelistedVotingAddresses(_secondWhitelistedAddress), true);
  }

  function testFuzz_EnableThenDisableWhitelistedAddress(
    address _whitelistedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond,
    string memory _proposalDescriptionThird
  ) public {
    vm.assume(keccak256(bytes(_proposalDescriptionFirst)) != keccak256(bytes(_proposalDescriptionThird)));
    vm.assume(_whitelistedAddress != address(0));
    vm.assume(_whitelistedAddress != address(timelock));

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createEnableWhitelistedAddressProposal(_whitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );
    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), true);

    ProposalBuilder secondBuilder = new ProposalBuilder();
    secondBuilder.push(
      address(governor), 0, abi.encodeWithSignature("disableWhitelistedVotingAddress(address)", _whitelistedAddress)
    );
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );
    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), false);

    ProposalBuilder thirdBuilder = _createEnableWhitelistedAddressProposal(_whitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      thirdBuilder.targets(), thirdBuilder.values(), thirdBuilder.calldatas(), _proposalDescriptionThird
    );

    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), true);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(address _whitelistedAddress, address _caller) public {
    vm.assume(_whitelistedAddress != address(0));
    vm.assume(_whitelistedAddress != address(timelock));
    vm.assume(_caller != address(timelock));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.enableWhitelistedVotingAddress(_whitelistedAddress);
  }
}

contract DisableWhitelistedVotingAddress is HubGovernorTest {
  function _createDisableWhitelistedVotingAddressProposal(address _whitelistedAddress) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("disableWhitelistedVotingAddress(address)", _whitelistedAddress));
  }

  function testFuzz_DisableWhitelistedAddress(address _whitelistedAddress, string memory _proposalDescription) public {
    vm.assume(_whitelistedAddress != address(0));
    vm.assume(_whitelistedAddress != address(timelock));

    governor.exposed_enableWhitelistedAddress(_whitelistedAddress);
    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), true);

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createDisableWhitelistedVotingAddressProposal(_whitelistedAddress);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);
    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), false);
  }

  function testFuzz_DisableMultipleAddresses(
    address _firstWhitelistedAddress,
    address _secondWhitelistedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_firstWhitelistedAddress != address(0) && _secondWhitelistedAddress != address(0));

    governor.exposed_enableWhitelistedAddress(_firstWhitelistedAddress);
    governor.exposed_enableWhitelistedAddress(_secondWhitelistedAddress);
    assertEq(governor.whitelistedVotingAddresses(_firstWhitelistedAddress), true);
    assertEq(governor.whitelistedVotingAddresses(_secondWhitelistedAddress), true);

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createDisableWhitelistedVotingAddressProposal(_firstWhitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );

    ProposalBuilder secondBuilder = _createDisableWhitelistedVotingAddressProposal(_secondWhitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );

    assertEq(governor.whitelistedVotingAddresses(_firstWhitelistedAddress), false);
    assertEq(governor.whitelistedVotingAddresses(_secondWhitelistedAddress), false);
  }

  function testFuzz_DisableThenEnableWhitelistedAddress(
    address _whitelistedAddress,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    vm.assume(_whitelistedAddress != address(0));
    vm.assume(_whitelistedAddress != address(timelock));

    governor.exposed_enableWhitelistedAddress(_whitelistedAddress);

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createDisableWhitelistedVotingAddressProposal(_whitelistedAddress);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );

    ProposalBuilder secondBuilder = new ProposalBuilder();
    secondBuilder.push(
      address(governor), 0, abi.encodeWithSignature("enableWhitelistedVotingAddress(address)", _whitelistedAddress)
    );
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );

    assertEq(governor.whitelistedVotingAddresses(_whitelistedAddress), true);
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(address _whitelistedAddress, address _caller) public {
    vm.assume(_whitelistedAddress != address(0));
    vm.assume(_whitelistedAddress != address(timelock));
    vm.assume(_caller != address(timelock));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.disableWhitelistedVotingAddress(_whitelistedAddress);
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
    assertEq(voteStart, block.timestamp + governor.votingDelay());
  }

  function testFuzz_UnwhitelistedProposerCanProposeWhenMeetingProposalThreshold(
    address _whitelistedProposer,
    address _proposer,
    string memory _description
  ) public {
    vm.assume(_whitelistedProposer != address(0));
    vm.assume(_proposer != address(0));

    ProposalBuilder builder = _createSetWhitelistedProposerProposal(_proposer);
    _setupDelegate(_proposer);

    governor.exposed_setWhitelistedProposer(_whitelistedProposer);

    vm.startPrank(_proposer);
    uint256 proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), _description);
    vm.stopPrank();

    uint256 voteStart = governor.proposalSnapshot(proposalId);
    assertEq(voteStart, block.timestamp + governor.votingDelay());
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
    uint256 quorum = governor.quorum(block.timestamp);
    assertEq(quorum, _quorum);
  }
}

contract SetWhitelistedProposer is HubGovernorTest {
  function testFuzz_CorrectlySetNewWhitelistedProposer(address _proposer) public {
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
    builder.push(address(governor), 0, abi.encodeWithSignature("setWhitelistedProposer(address)", _proposer));
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    assertEq(governor.whitelistedProposer(), _proposer);
  }

  function testFuzz_EmitsWhitelistedProposerUpdated(address _proposer) public {
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
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
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
