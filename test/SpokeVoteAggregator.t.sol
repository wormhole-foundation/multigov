// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test, console2} from "forge-std/Test.sol";

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";
import {SpokeVoteAggregatorHarness} from "test/harnesses/SpokeVoteAggregatorHarness.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {WormholeMock} from "wormhole-solidity-sdk/testing/helpers/WormholeMock.sol";

contract SpokeVoteAggregatorTest is Test {
  SpokeVoteAggregatorHarness public spokeVoteAggregator;
  ERC20VotesFake public token;
  WormholeMock public wormhole;
  uint16 immutable HUB_CHAIN_ID = 2;
  address owner = makeAddr("Spoke Vote Aggregator Owner");

  function setUp() public {
    address _hubProposalMetadataSender = makeAddr("Hub proposal metadata");
    wormhole = new WormholeMock();
    token = new ERC20VotesFake();
    spokeVoteAggregator = new SpokeVoteAggregatorHarness(
      address(wormhole), HUB_CHAIN_ID, _hubProposalMetadataSender, address(token), 1 days, owner
    );
  }

  function _boundProposalTime(uint48 _voteStart, uint48 _voteEnd) internal pure returns (uint48, uint48) {
    _voteStart = uint48(bound(_voteStart, 1, type(uint48).max - 2));
    _voteEnd = uint48(bound(_voteEnd, _voteStart, type(uint48).max - 1));
    return (_voteStart, _voteEnd);
  }
}

contract Constructor is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlySetConstructorArgs(
    address _token,
    uint32 _safeWindow,
    address _wormholeCore,
    uint16 _hubChainId,
    address _hubProposalMetadataSender,
    address _owner
  ) public {
    vm.assume(_wormholeCore != address(0));
    SpokeVoteAggregator spokeVoteAggregator =
      new SpokeVoteAggregator(_wormholeCore, _hubChainId, _hubProposalMetadataSender, _token, _safeWindow, _owner);
    assertEq(address(spokeVoteAggregator.VOTING_TOKEN()), _token);
    assertEq(spokeVoteAggregator.safeWindow(), _safeWindow);
    assertEq(spokeVoteAggregator.owner(), _owner);
    assertEq(address(spokeVoteAggregator.WORMHOLE_CORE()), _wormholeCore);
    assertEq(spokeVoteAggregator.HUB_CHAIN_ID(), _hubChainId);
    assertEq(spokeVoteAggregator.HUB_PROPOSAL_METADATA(), _hubProposalMetadataSender);
  }
}

contract State is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyGetStateOfPendingProposal(uint256 _proposalId, uint48 _voteStart, uint48 _voteEnd) public {
    vm.assume(_proposalId != 0);
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);
    vm.warp(_voteStart - 1);
    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd);
    SpokeVoteAggregator.ProposalState state = spokeVoteAggregator.state(_proposalId);
    assertEq(uint8(state), uint8(SpokeVoteAggregator.ProposalState.Pending));
  }

  function testFuzz_CorrectlyGetStateOfActiveProposal(uint256 _proposalId, uint48 _voteStart, uint48 _voteEnd) public {
    vm.assume(_proposalId != 0);
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);

    vm.warp(_voteStart);
    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd);
    SpokeVoteAggregator.ProposalState state = spokeVoteAggregator.state(_proposalId);
    assertEq(uint8(state), uint8(SpokeVoteAggregator.ProposalState.Active));
  }

  function testFuzz_CorrectlyGetStateOfExpiredProposal(uint256 _proposalId, uint48 _voteStart, uint48 _voteEnd) public {
    vm.assume(_proposalId != 0);
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);
    vm.warp(_voteEnd + 1);

    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd);
    SpokeVoteAggregator.ProposalState state = spokeVoteAggregator.state(_proposalId);
    assertEq(uint8(state), uint8(SpokeVoteAggregator.ProposalState.Expired));
  }
}

contract CastVote is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyCastVoteAgainst(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd,
    address _caller
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_proposalId != 0);
    vm.assume(_caller != address(0));
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd + 1);

    vm.startPrank(_caller);
    vm.warp(uint48(_voteStart) + 1);
    spokeVoteAggregator.castVote(_proposalId, uint8(SpokeCountingFractional.VoteType.Against));

    (uint256 against,,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(against, _amount, "Votes against are not correct");
  }

  function testFuzz_CorrectlyCastVoteFor(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd,
    address _caller
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_proposalId != 0);
    vm.assume(_caller != address(0));
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd + 1);

    vm.startPrank(_caller);
    vm.warp(uint48(_voteStart) + 1);
    spokeVoteAggregator.castVote(_proposalId, uint8(SpokeCountingFractional.VoteType.For));

    (, uint256 forVotes,) = spokeVoteAggregator.proposalVotes(_proposalId);

    assertEq(forVotes, _amount, "Votes for are not correct");
  }

  function testFuzz_CorrectlyCastVoteAbstain(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd,
    address _caller
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_proposalId != 0);
    vm.assume(_caller != address(0));
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd + 1);

    vm.startPrank(_caller);
    vm.warp(uint48(_voteStart) + 1);
    spokeVoteAggregator.castVote(_proposalId, uint8(SpokeCountingFractional.VoteType.Abstain));

    (,, uint256 abstain) = spokeVoteAggregator.proposalVotes(_proposalId);

    assertEq(abstain, _amount, "Abstained votes are not correct");
  }

  function testFuzz_RevertWhen_BeforeProposalStart(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd,
    address _caller
  ) public {
    vm.assume(_proposalId != 0);
    vm.assume(_caller != address(0));
    _voteStart = uint32(bound(_voteStart, 2, type(uint32).max));
    _support = uint8(bound(_support, 0, 2));
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);

    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd);

    vm.warp(_voteStart - 1);
    vm.startPrank(_caller);
    vm.expectRevert(SpokeVoteAggregator.ProposalInactive.selector);
    spokeVoteAggregator.castVote(_proposalId, _support);
    vm.stopPrank();
  }

  function testFuzz_RevertWhen_VoterHasAlreadyVoted(
    uint128 _amount,
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd,
    address _caller
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_proposalId != 0);
    vm.assume(_caller != address(0));
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    _support = uint8(bound(_support, 0, 2));
    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd + 1);

    vm.startPrank(_caller);
    vm.warp(uint48(_voteStart) + 1);
    spokeVoteAggregator.castVote(_proposalId, _support);

    vm.expectRevert("SpokeCountingFractional: all weight cast");
    spokeVoteAggregator.castVote(_proposalId, _support);
    vm.stopPrank();
  }
}

contract SetSafeWindow is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlySetSafeWindow(uint32 _safeWindow) public {
    vm.prank(owner);
    spokeVoteAggregator.setSafeWindow(_safeWindow);
    assertEq(spokeVoteAggregator.safeWindow(), _safeWindow);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint32 _safeWindow, address _caller) public {
    vm.assume(owner != _caller);

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(SpokeVoteAggregator.OwnerUnauthorizedAccount.selector, _caller));
    spokeVoteAggregator.setSafeWindow(_safeWindow);
  }
}

contract IsVotingSafe is SpokeVoteAggregatorTest {
  function testFuzz_GetIsProposalSafeForSafeProposal(
    uint16 _safeWindow,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd
  ) public {
    vm.assume(_safeWindow != 0);
    vm.assume(_proposalId != 0);
    _voteStart = uint48(bound(_voteStart, 1, type(uint48).max - _safeWindow));
    _voteEnd = uint48(bound(_voteEnd, _voteStart + _safeWindow, type(uint48).max));
    spokeVoteAggregator.exposed_setSafeWindow(_safeWindow);
    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd);

    vm.warp(_voteStart);
    bool isSafe = spokeVoteAggregator.isVotingSafe(_proposalId);
    assertEq(isSafe, true);
  }

  function testFuzz_GetIsProposalSafeForUnsafeProposal(
    uint16 _safeWindow,
    uint256 _proposalId,
    uint48 _voteStart,
    uint48 _voteEnd
  ) public {
    vm.assume(_safeWindow != 0);
    vm.assume(_proposalId != 0);
    (_voteStart, _voteEnd) = _boundProposalTime(_voteStart, _voteEnd);
    _voteEnd = uint16(bound(_voteEnd, _safeWindow, type(uint16).max));
    spokeVoteAggregator.exposed_setSafeWindow(_safeWindow);
    spokeVoteAggregator.workaround_createProposal(_proposalId, _voteStart, _voteEnd);

    vm.warp(_voteEnd - _safeWindow + 1);
    bool isSafe = spokeVoteAggregator.isVotingSafe(_proposalId);
    assertEq(isSafe, false);
  }
}
