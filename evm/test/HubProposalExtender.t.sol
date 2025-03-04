// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {HubProposalExtenderHarness} from "test/harnesses/HubProposalExtenderHarness.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {HubGovernorTest} from "test/HubGovernor.t.sol";

contract HubProposalExtenderTest is Test, HubGovernorTest {
  HubProposalExtenderHarness hubExtender;
  address whitelistedExtender = makeAddr("Whitelisted Extender");
  address initialExtenderOwner = makeAddr("Proposal extender");
  uint48 extensionDuration = 3 hours;
  uint48 minimumTime = 1 hours;
  uint32 voteWeightWindow = 1 days;

  function _boundProposalSafeWindow(uint48 _voteStart, uint48 _safeWindow) internal view returns (uint48, uint48) {
    _voteStart =
      uint48(bound(_voteStart, VOTE_WEIGHT_WINDOW + block.timestamp, type(uint48).max - governor.votingPeriod()));
    _safeWindow = uint48(bound(_safeWindow, 1, governor.votingPeriod()));
    return (_voteStart, _safeWindow);
  }

  function setUp() public virtual override {
    HubGovernorTest.setUp();
    hubExtender = new HubProposalExtenderHarness(
      whitelistedExtender,
      extensionDuration,
      address(timelock),
      initialExtenderOwner,
      minimumTime,
      voteWeightWindow,
      minimumTime
    );

    vm.prank(initialExtenderOwner);
    hubExtender.initialize(payable(address(governor)));
  }
}

contract Constructor is HubProposalExtenderTest {
  function testFuzz_CorrectlySetConstructorArgs(
    address _whitelistedVoteExtender,
    uint48 _extensionDuration,
    address _owner,
    uint48 _minimumExtensionDuration,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) public {
    vm.assume(_owner != address(0));
    hubExtender = new HubProposalExtenderHarness(
      _whitelistedVoteExtender,
      _extensionDuration,
      _owner,
      initialExtenderOwner,
      _minimumExtensionDuration,
      _safeWindow,
      _minimumDecisionWindow
    );
    assertEq(hubExtender.voteExtenderAdmin(), _whitelistedVoteExtender);
    assertEq(hubExtender.extensionDuration(), _extensionDuration);
    assertEq(hubExtender.owner(), _owner);
    assertEq(hubExtender.MINIMUM_EXTENSION_DURATION(), _minimumExtensionDuration);
  }

  function test_RevertIf_DeployerIsZeroAddress() public {
    vm.expectRevert(HubProposalExtender.DeployerIsZeroAddress.selector);
    new HubProposalExtenderHarness(
      whitelistedExtender, extensionDuration, address(timelock), address(0), minimumTime, voteWeightWindow, minimumTime
    );
  }
}

contract Initialize is HubProposalExtenderTest {
  function testFuzz_CorrectlySetGovernor(
    address _whitelistedVoteExtender,
    uint48 _extensionDuration,
    address _governor,
    uint48 _minimumExtensionDuration,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) public {
    hubExtender = new HubProposalExtenderHarness(
      _whitelistedVoteExtender,
      _extensionDuration,
      initialOwner,
      initialExtenderOwner,
      _minimumExtensionDuration,
      _safeWindow,
      _minimumDecisionWindow
    );
    vm.prank(initialExtenderOwner);
    hubExtender.initialize(payable(_governor));
    assertEq(address(hubExtender.governor()), _governor);
  }

  function testFuzz_RevertIf_InitializedTwice(
    address _whitelistedVoteExtender,
    uint48 _extensionDuration,
    address _governor,
    uint48 _minimumExtensionDuration,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  ) public {
    hubExtender = new HubProposalExtenderHarness(
      _whitelistedVoteExtender,
      _extensionDuration,
      initialOwner,
      initialExtenderOwner,
      _minimumExtensionDuration,
      _safeWindow,
      _minimumDecisionWindow
    );
    vm.prank(initialExtenderOwner);
    hubExtender.initialize(payable(_governor));

    vm.expectRevert(HubProposalExtender.AlreadyInitialized.selector);
    vm.prank(initialExtenderOwner);
    hubExtender.initialize(payable(_governor));
  }

  function testFuzz_RevertIf_CallerIsNotTheOwner(
    address _whitelistedVoteExtender,
    uint48 _extensionDuration,
    address _governor,
    uint48 _minimumExtensionDuration,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow,
    address _caller,
    address _owner
  ) public {
    vm.assume(_caller != initialExtenderOwner && _owner != address(0));
    hubExtender = new HubProposalExtenderHarness(
      _whitelistedVoteExtender,
      _extensionDuration,
      _owner,
      initialExtenderOwner,
      _minimumExtensionDuration,
      _safeWindow,
      _minimumDecisionWindow
    );
    vm.expectRevert(abi.encodeWithSelector(HubProposalExtender.UnauthorizedInitialize.selector, _caller));
    vm.prank(_caller);
    hubExtender.initialize(payable(_governor));
  }
}

contract ExtendProposal is HubProposalExtenderTest {
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

    assertEq(hubExtender.extendedDeadlines(_proposalId), voteEnd + hubExtender.extensionDuration());
  }

  function testFuzz_EmitsProposalExtendedEvent(address _proposer) public {
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.startPrank(delegates[0]);
    ProposalBuilder builder = _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _proposer));

    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    uint256 voteEnd = governor.proposalDeadline(_proposalId);
    vm.warp(voteEnd - 1);
    vm.expectEmit();
    emit HubProposalExtender.ProposalExtended(_proposalId, uint48(voteEnd) + hubExtender.extensionDuration());
    vm.prank(whitelistedExtender);
    hubExtender.extendProposal(_proposalId);

    assertEq(hubExtender.extendedDeadlines(_proposalId), voteEnd + hubExtender.extensionDuration());
  }

  function testFuzz_RevertIf_CallerIsNotTheVoteExtenderAddress(address _caller, uint256 _proposalId) public {
    vm.assume(_caller != whitelistedExtender);
    vm.prank(_caller);
    vm.expectRevert(HubProposalExtender.AddressCannotExtendProposal.selector);
    hubExtender.extendProposal(_proposalId);
  }

  function testFuzz_RevertIf_ProposalDoesNotExist(uint256 _proposalId) public {
    vm.prank(whitelistedExtender);
    vm.expectRevert(HubProposalExtender.ProposalDoesNotExist.selector);
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

    vm.expectRevert(HubProposalExtender.ProposalAlreadyExtended.selector);
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
    vm.expectRevert(HubProposalExtender.ProposalCannotBeExtended.selector);
    hubExtender.extendProposal(_proposalId);
  }
}

contract setExtensionDuration is HubProposalExtenderTest {
  function testFuzz_CorrectlyChangeExtensionTime(uint48 _extensionDuration) public {
    _extensionDuration = uint48(bound(_extensionDuration, minimumTime, governor.votingPeriod() - 1));
    _setGovernorAndDelegates();
    vm.warp(block.timestamp + 1 days);
    ProposalBuilder builder =
      _createProposal(address(hubExtender), abi.encodeWithSignature("setExtensionDuration(uint48)", _extensionDuration));

    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");

    assertEq(hubExtender.extensionDuration(), _extensionDuration);
  }

  function testFuzz_EmitsextensionDurationTimeUpdatedEvent(uint48 _extensionDuration) public {
    _extensionDuration = uint48(bound(_extensionDuration, minimumTime, governor.votingPeriod()));
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.warp(vm.getBlockTimestamp() + 7 days);
    ProposalBuilder builder =
      _createProposal(address(hubExtender), abi.encodeWithSignature("setExtensionDuration(uint48)", _extensionDuration));

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
    emit HubProposalExtender.ExtensionDurationUpdated(extensionDuration, _extensionDuration);
    governor.execute(builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description)));
  }

  function testFuzz_RevertIf_CallerIsNotTheTimelock(address _caller, uint48 _extensionDuration) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubExtender.setExtensionDuration(_extensionDuration);
  }
}

contract SetVoteExtenderAdmin is HubProposalExtenderTest {
  function testFuzz_CorrectlyChangeExtensionTime(address _voteExtender) public {
    _setGovernorAndDelegates();
    ProposalBuilder builder =
      _createProposal(address(hubExtender), abi.encodeWithSignature("setVoteExtenderAdmin(address)", _voteExtender));

    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");

    assertEq(hubExtender.voteExtenderAdmin(), _voteExtender);
  }

  function testFuzz_EmitsdVotedExtenderAdminUpdatedEvent(address _voteExtender) public {
    vm.assume(_voteExtender != address(timelock));
    (, address[] memory delegates) = _setGovernorAndDelegates();
    ProposalBuilder builder =
      _createProposal(address(hubExtender), abi.encodeWithSignature("setVoteExtenderAdmin(address)", _voteExtender));

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
    emit HubProposalExtender.VoteExtenderAdminUpdated(whitelistedExtender, _voteExtender);
    governor.execute(builder.targets(), builder.values(), builder.calldatas(), keccak256(bytes(_description)));
  }

  function testFuzz_RevertIf_CallerIsNotTheTimelock(address _caller, address _voteExtender) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubExtender.setVoteExtenderAdmin(_voteExtender);
  }
}
