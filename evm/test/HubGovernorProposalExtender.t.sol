// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubGovernorProposalExtenderHarness} from "test/harnesses/HubGovernorProposalExtenderHarness.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {HubGovernorProposalExtender} from "src/HubGovernorProposalExtender.sol";
import {HubGovernorTest} from "test/HubGovernor.t.sol";

contract HubGovernorProposalExtenderTest is Test, HubGovernorTest {
  HubGovernorProposalExtenderHarness hubExtender;
  address whitelistedExtender = makeAddr("Whitelisted Extender");
  uint48 extensionTime = 3 hours;
  uint48 minimumTime = 1 hours;
  uint32 voteWeightWindow = 1 days;

  function _boundProposalSafeWindow(uint48 _voteStart, uint48 _safeWindow) internal view returns (uint48, uint48) {
    _voteStart = uint48(bound(_voteStart, VOTE_WINDOW + block.timestamp, type(uint48).max - governor.votingPeriod()));
    _safeWindow = uint48(bound(_safeWindow, 1, governor.votingPeriod()));
    return (_voteStart, _safeWindow);
  }

  function setUp() public virtual override {
    HubGovernorTest.setUp();
    hubExtender = new HubGovernorProposalExtenderHarness(
      whitelistedExtender, extensionTime, address(timelock), minimumTime, voteWeightWindow, minimumTime
    );

    vm.prank(address(timelock));
    hubExtender.initialize(payable(address(governor)));
  }
}

contract Constructor is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlySetConstructorArgs(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _owner,
    uint48 _minimumExtensionTime,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) public {
    vm.assume(_owner != address(0));
    hubExtender = new HubGovernorProposalExtenderHarness(
      _whitelistedVoteExtender, _voteTimeExtension, _owner, _minimumExtensionTime, _safeWindow, _minimumDecisionWindow
    );
    assertEq(hubExtender.whitelistedVoteExtender(), _whitelistedVoteExtender);
    assertEq(hubExtender.proposalExtension(), _voteTimeExtension);
    assertEq(hubExtender.owner(), _owner);
    assertEq(hubExtender.MINIMUM_EXTENSION_TIME(), _minimumExtensionTime);
  }
}

contract Initialize is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlySetGovernor(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _governor,
    uint48 _minimumExtensionTime,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) public {
    hubExtender = new HubGovernorProposalExtenderHarness(
      _whitelistedVoteExtender,
      _voteTimeExtension,
      initialOwner,
      _minimumExtensionTime,
      _safeWindow,
      _minimumDecisionWindow
    );
    hubExtender.initialize(payable(_governor));
    assertEq(address(hubExtender.governor()), _governor);
  }

  function testFuzz_RevertIf_InitializedTwice(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _governor,
    uint48 _minimumExtensionTime,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) public {
    hubExtender = new HubGovernorProposalExtenderHarness(
      _whitelistedVoteExtender,
      _voteTimeExtension,
      initialOwner,
      _minimumExtensionTime,
      _safeWindow,
      _minimumDecisionWindow
    );
    hubExtender.initialize(payable(_governor));

    vm.expectRevert(HubGovernorProposalExtender.AlreadyInitialized.selector);
    hubExtender.initialize(payable(_governor));
  }
}

contract ExtendProposal is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlyExtendTheProposal(address _proposer) public {
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.startPrank(delegates[0]);
    ProposalBuilder builder = _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _proposer));

    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    uint256 voteEnd = governor.proposalDeadline(_proposalId);
    vm.warp(voteEnd - 1);
    vm.prank(whitelistedExtender);
    hubExtender.extendProposal(_proposalId);

    assertEq(hubExtender.extendedDeadlines(_proposalId), voteEnd + hubExtender.proposalExtension());
  }

  function testFuzz_RevertIf_CallerIsNotTheVoteExtenderAddress(address _caller, uint256 _proposalId) public {
    vm.assume(_caller != whitelistedExtender);
    vm.prank(_caller);
    vm.expectRevert(HubGovernorProposalExtender.AddressCannotExtendProposal.selector);
    hubExtender.extendProposal(_proposalId);
  }

  function testFuzz_RevertIf_ProposalDoesNotExist(uint256 _proposalId) public {
    vm.prank(whitelistedExtender);
    vm.expectRevert(HubGovernorProposalExtender.ProposalDoesNotExist.selector);
    hubExtender.extendProposal(_proposalId);
  }

  function testFuzz_RevertIf_ProposalHasAlreadyBeenExtended(address _proposer) public {
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.startPrank(delegates[0]);
    ProposalBuilder builder = _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _proposer));

    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    vm.warp(governor.proposalDeadline(_proposalId) - 1);
    vm.prank(whitelistedExtender);
    hubExtender.extendProposal(_proposalId);

    vm.expectRevert(HubGovernorProposalExtender.ProposalAlreadyExtended.selector);
    vm.prank(whitelistedExtender);
    hubExtender.extendProposal(_proposalId);
  }

  function testFuzz_RevertIf_ProposalNotActive(address _proposer) public {
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.startPrank(delegates[0]);
    ProposalBuilder builder = _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _proposer));

    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    vm.warp(governor.proposalDeadline(_proposalId) + 1);
    vm.prank(whitelistedExtender);
    vm.expectRevert(HubGovernorProposalExtender.ProposalCannotBeExtended.selector);
    hubExtender.extendProposal(_proposalId);
  }

  function testFuzz_RevertIf_ProposalVotingIsSafe(address _proposer) public {
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.startPrank(delegates[0]);
    ProposalBuilder builder = _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _proposer));

    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    vm.warp(governor.proposalSnapshot(_proposalId) + hubExtender.safeWindow());
    assertTrue(hubExtender.isVotingSafe(_proposalId));

    vm.prank(whitelistedExtender);
    vm.expectRevert(HubGovernorProposalExtender.ProposalCannotBeExtended.selector);
    hubExtender.extendProposal(_proposalId);
  }
}

contract SetProposalExtension is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlyChangeExtensionTime(uint48 _extensionTime) public {
    _extensionTime = uint48(bound(_extensionTime, minimumTime, governor.votingPeriod() - 1));
    _setGovernorAndDelegates();
    vm.warp(block.timestamp + 1 days);
    ProposalBuilder builder =
      _createProposal(address(hubExtender), abi.encodeWithSignature("setProposalExtension(uint48)", _extensionTime));

    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");

    assertEq(hubExtender.proposalExtension(), _extensionTime);
  }

  function testFuzz_EmitsProposalExtensionTimeUpdatedEvent(uint48 _extensionTime) public {
    _extensionTime = uint48(bound(_extensionTime, minimumTime, governor.votingPeriod()));
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.warp(vm.getBlockTimestamp() + 7 days);
    ProposalBuilder builder =
      _createProposal(address(hubExtender), abi.encodeWithSignature("setProposalExtension(uint48)", _extensionTime));

    string memory _description = "Hi";
    vm.startPrank(delegates[0]);
    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), _description);
    vm.stopPrank();

    IGovernor.ProposalState _state = governor.state(_proposalId);
    assertEq(uint8(_state), uint8(IGovernor.ProposalState.Pending));

    _jumpToActiveProposal(_proposalId);

    _delegatesVote(_proposalId, uint8(VoteType.For));
    _jumpPastVoteComplete(_proposalId);

    governor.queue(builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description)));

    _jumpPastProposalEta(_proposalId);

    vm.expectEmit();
    emit HubGovernorProposalExtender.ProposalExtensionTimeUpdated(extensionTime, _extensionTime);
    governor.execute(builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description)));
  }

  function testFuzz_RevertIf_CallerIsNotTheTimelock(address _caller, uint48 _extensionTime) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubExtender.setProposalExtension(_extensionTime);
  }
}

contract SetWhitelistedVoteExtender is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlyChangeExtensionTime(address _voteExtender) public {
    _setGovernorAndDelegates();
    ProposalBuilder builder = _createProposal(
      address(hubExtender), abi.encodeWithSignature("setWhitelistedVoteExtender(address)", _voteExtender)
    );

    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");

    assertEq(hubExtender.whitelistedVoteExtender(), _voteExtender);
  }

  function testFuzz_EmitsWhitelistedVotedExtenderUpdatedEvent(address _voteExtender) public {
    vm.assume(_voteExtender != address(timelock));
    (, address[] memory delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder = _createProposal(
      address(hubExtender), abi.encodeWithSignature("setWhitelistedVoteExtender(address)", _voteExtender)
    );

    string memory _description = "Hi";
    vm.startPrank(delegates[0]);
    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), _description);
    vm.stopPrank();

    IGovernor.ProposalState _state = governor.state(_proposalId);
    assertEq(uint8(_state), uint8(IGovernor.ProposalState.Pending));

    _jumpToActiveProposal(_proposalId);

    _delegatesVote(_proposalId, uint8(VoteType.For));
    _jumpPastVoteComplete(_proposalId);

    governor.queue(builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description)));

    _jumpPastProposalEta(_proposalId);

    vm.expectEmit();
    emit HubGovernorProposalExtender.WhitelistedVoteExtenderUpdated(whitelistedExtender, _voteExtender);
    governor.execute(builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description)));
  }

  function testFuzz_RevertIf_CallerIsNotTheTimelock(address _caller, address _voteExtender) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubExtender.setWhitelistedVoteExtender(_voteExtender);
  }
}

contract IsVotingSafe is HubGovernorProposalExtenderTest {
  function testFuzz_GetIsProposalSafeForSafeProposal(uint16 _safeWindow, uint48 _voteStart) public {
    vm.assume(_safeWindow != 0);
    (, address[] memory delegates) = _setGovernorAndDelegates();

    hubExtender.exposed_setSafeWindow(_safeWindow);
    // Create fake proposal
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(makeAddr("Hi"), 0, abi.encode(1));

    _voteStart =
      uint48(bound(_voteStart, VOTE_WINDOW + block.timestamp, type(uint48).max - _safeWindow - governor.votingDelay()));

    vm.warp(_voteStart);
    vm.startPrank(delegates[0]);
    uint256 proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "");
    vm.stopPrank();
    bool isSafe = hubExtender.isVotingSafe(proposalId);
    assertEq(isSafe, true);
  }

  function testFuzz_GetIsProposalSafeForUnsafeProposal(uint48 _safeWindow, uint256 _proposalId, uint48 _voteStart)
    public
  {
    vm.assume(_safeWindow != 0);
    vm.assume(_proposalId != 0);
    (, address[] memory delegates) = _setGovernorAndDelegates();
    (_voteStart, _safeWindow) = _boundProposalSafeWindow(_voteStart, _safeWindow);
    hubExtender.exposed_setSafeWindow(_safeWindow);

    // Create fake proposal
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(makeAddr("Hi"), 0, abi.encode(1));

    vm.warp(_voteStart);
    vm.startPrank(delegates[0]);
    governor.propose(builder.targets(), builder.values(), builder.calldatas(), "");
    vm.stopPrank();

    vm.warp(_voteStart + _safeWindow + 1);
    bool isSafe = hubExtender.isVotingSafe(_proposalId);
    assertEq(isSafe, false);
  }
}

contract SetSafeWindow is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlySetSafeWindow(uint48 _safeWindow) public {
    _safeWindow = uint48(bound(_safeWindow, minimumTime, governor.votingPeriod() - 1 hours));
    vm.prank(address(timelock));
    hubExtender.setSafeWindow(_safeWindow);
    assertEq(hubExtender.safeWindow(), _safeWindow);
  }

  function testFuzz_EmitsASetSafeWindowUpdatedEvent(uint48 _safeWindow) public {
    _safeWindow = uint48(bound(_safeWindow, 0, governor.votingPeriod() - minimumTime));
    vm.expectEmit();
    emit HubGovernorProposalExtender.SafeWindowUpdated(hubExtender.safeWindow(), _safeWindow);
    vm.prank(address(timelock));
    hubExtender.setSafeWindow(_safeWindow);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint48 _safeWindow, address _caller) public {
    vm.assume(address(timelock) != _caller);

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubExtender.setSafeWindow(_safeWindow);
  }

  // Invalid extension time
  function testFuzz_RevertIf_SafeWindowIsGreaterThanMinimumDecisionWindow(uint48 _safeWindow) public {
    _safeWindow = uint48(bound(_safeWindow, governor.votingPeriod() - minimumTime + 1, type(uint48).max));
    vm.expectRevert(HubGovernorProposalExtender.InvalidUnsafeWindow.selector);
    vm.prank(address(timelock));
    hubExtender.setSafeWindow(_safeWindow);
  }
}
