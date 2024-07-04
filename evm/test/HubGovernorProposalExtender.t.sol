// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {HubGovernorProposalExtender} from "src/HubGovernorProposalExtender.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";
import {HubGovernorTest} from "test/HubGovernor.t.sol";

contract HubGovernorProposalExtenderTest is Test, HubGovernorTest {
  HubGovernorProposalExtender hubExtender;
  address whitelistedExtender = makeAddr("Whitelisted Extender");
  uint48 extensionTime = 3 hours;
  uint48 minimumTime = 1 hours;

  function setUp() public virtual override {
    HubGovernorTest.setUp();
    hubExtender = new HubGovernorProposalExtender(whitelistedExtender, extensionTime, initialOwner, minimumTime);
    hubExtender.initialize(payable(address(governor)));
    vm.prank(initialOwner);
    hubExtender.transferOwnership(address(timelock));
  }
}

contract Constructor is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlySetConstructorArgs(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _owner,
    uint48 _minimumExtensionTime
  ) public {
    vm.assume(_owner != address(0));
    hubExtender =
      new HubGovernorProposalExtender(_whitelistedVoteExtender, _voteTimeExtension, _owner, _minimumExtensionTime);
    assertEq(hubExtender.whitelistedVoteExtender(), _whitelistedVoteExtender);
    assertEq(hubExtender.proposalExtension(), _voteTimeExtension);
    assertEq(hubExtender.owner(), _owner);
    assertEq(hubExtender.minimumExtensionTime(), _minimumExtensionTime);
  }
}

contract Initialize is HubGovernorProposalExtenderTest {
  function testFuzz_CorrectlyInitializeGovernor(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _governor,
    uint48 _minimumExtensionTime
  ) public {
    hubExtender =
      new HubGovernorProposalExtender(_whitelistedVoteExtender, _voteTimeExtension, initialOwner, _minimumExtensionTime);
    hubExtender.initialize(payable(_governor));
    assertEq(address(hubExtender.governor()), _governor);
  }

  function testFuzz_RevertIf_InitializedTwice(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _governor,
    uint48 _minimumExtensionTime
  ) public {
    hubExtender =
      new HubGovernorProposalExtender(_whitelistedVoteExtender, _voteTimeExtension, initialOwner, _minimumExtensionTime);
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

  // Need to simulate a real proposal to handle the different proposal states
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

  function testFuzz_RevertIf_ProposalCannotBeExtendedIfNotActive(address _proposer) public {
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

  function testFuzz_RevertIf_ProposalCannotBeExtendedIfVotingIsNotSafe(address _proposer) public {
    (, address[] memory delegates) = _setGovernorAndDelegates();
    vm.startPrank(delegates[0]);
    ProposalBuilder builder = _createProposal(abi.encodeWithSignature("setHubVotePool(address)", _proposer));

    uint256 _proposalId = governor.propose(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    vm.stopPrank();

    vm.warp(governor.proposalSnapshot(_proposalId) + HubVotePool(hubVotePool).safeWindow());
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

  function testFuzz_ChangingExtensionTimeEmitsProposalExtensionTimeUpdatedEvent(uint48 _extensionTime) public {
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

  function testFuzz_ChangingExtensionTimeEmitsWhitelistedVotedExtenderUpdatedEvent(address _voteExtender) public {
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
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubExtender.setWhitelistedVoteExtender(_voteExtender);
  }
}
