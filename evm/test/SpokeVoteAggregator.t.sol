// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {WormholeMock} from "wormhole-solidity-sdk/testing/helpers/WormholeMock.sol";
import {Test, console2} from "forge-std/Test.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";
import {SpokeMetadataCollectorHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";
import {SpokeVoteAggregatorHarness} from "test/harnesses/SpokeVoteAggregatorHarness.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

contract SpokeVoteAggregatorTest is Test {
  SpokeVoteAggregatorHarness public spokeVoteAggregator;
  SpokeMetadataCollectorHarness public spokeMetadataCollector;
  ERC20VotesFake public token;
  WormholeMock public wormhole;
  uint16 immutable HUB_CHAIN_ID = 2;
  uint48 initialSafeWindow = 1 days;
  address owner;

  function setUp() public {
    address _hubProposalMetadataSender = makeAddr("Hub proposal metadata");
    owner = makeAddr("Aggregator owner");
    wormhole = new WormholeMock();
    token = new ERC20VotesFake();
    spokeMetadataCollector =
      new SpokeMetadataCollectorHarness(address(wormhole), HUB_CHAIN_ID, _hubProposalMetadataSender);
    spokeVoteAggregator = new SpokeVoteAggregatorHarness(address(spokeMetadataCollector), address(token), owner, 1 days);
  }

  function _boundProposalTime(uint48 _voteStart) internal pure returns (uint48) {
    _voteStart = uint48(bound(_voteStart, 1, type(uint48).max - 2));
    return _voteStart;
  }

  function _getVoteData(SpokeCountingFractional.ProposalVote memory _votes) internal pure returns (bytes memory) {
    uint128 remainingVotes = type(uint128).max;

    _votes.againstVotes = uint128(bound(_votes.againstVotes, 0, remainingVotes));
    remainingVotes -= _votes.againstVotes;

    _votes.forVotes = uint128(bound(_votes.forVotes, 0, remainingVotes));
    remainingVotes -= _votes.forVotes;

    _votes.abstainVotes = uint128(bound(_votes.abstainVotes, 0, remainingVotes));

    bytes memory _voteData =
      abi.encodePacked(uint128(_votes.againstVotes), uint128(_votes.forVotes), uint128(_votes.abstainVotes));

    return _voteData;
  }

  function _getTotalWeight(SpokeCountingFractional.ProposalVote memory _votes) internal pure returns (uint256) {
    return uint128(_votes.againstVotes) + _votes.forVotes + _votes.abstainVotes;
  }
}

contract Constructor is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlySetConstructorArgs(
    address _token,
    address _spokeMetadataCollector,
    address _owner,
    uint48 _voteWeightWindow
  ) public {
    vm.assume(_owner != address(0));
    SpokeVoteAggregator spokeVoteAggregator =
      new SpokeVoteAggregator(_spokeMetadataCollector, _token, _owner, _voteWeightWindow);
    assertEq(address(spokeVoteAggregator.VOTING_TOKEN()), _token);
    assertEq(address(spokeVoteAggregator.spokeMetadataCollector()), _spokeMetadataCollector);
  }
}

contract CastVote is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyCastVoteAgainst(uint128 _amount, uint256 _proposalId, uint48 _voteStart, address _caller)
    public
  {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);
    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.startPrank(_caller);
    vm.warp(_voteStart + 1);
    spokeVoteAggregator.castVote(_proposalId, uint8(SpokeCountingFractional.VoteType.Against));

    (uint256 against,,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(against, _amount, "Votes against are not correct");
  }

  function testFuzz_CorrectlyCastVoteFor(uint128 _amount, uint256 _proposalId, uint48 _voteStart, address _caller)
    public
  {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.startPrank(_caller);
    vm.warp(uint48(_voteStart) + 1);
    spokeVoteAggregator.castVote(_proposalId, uint8(SpokeCountingFractional.VoteType.For));

    (, uint256 forVotes,) = spokeVoteAggregator.proposalVotes(_proposalId);

    assertEq(forVotes, _amount, "Votes for are not correct");
  }

  function testFuzz_CorrectlyCastVoteAbstain(uint128 _amount, uint256 _proposalId, uint48 _voteStart, address _caller)
    public
  {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);
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
    address _caller
  ) public {
    vm.assume(_caller != address(0));
    _voteStart = uint32(bound(_voteStart, 2, type(uint32).max));
    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

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
    address _caller
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    _support = uint8(bound(_support, 0, 2));
    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.startPrank(_caller);
    vm.warp(uint48(_voteStart) + 1);
    spokeVoteAggregator.castVote(_proposalId, _support);

    vm.expectRevert("SpokeCountingFractional: all weight cast");
    spokeVoteAggregator.castVote(_proposalId, _support);
    vm.stopPrank();
  }

  function testFuzz_RevertIf_CallerHasNoWeight(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    uint128 _amount
  ) public {
    vm.assume(_caller != address(0));
    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);

    // Delegate to the caller
    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    // Warp to after the proposal starts then delegate from caller to someone else to ensure the caller has no weight
    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    token.delegate(makeAddr("Other Delegate"));

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(vm.getBlockTimestamp() + 1);
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(SpokeVoteAggregator.NoWeight.selector));
    spokeVoteAggregator.castVote(_proposalId, _support);
  }
}

contract CastVoteWithReason is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyCastVoteAgainst(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReason(_proposalId, uint8(SpokeCountingFractional.VoteType.Against), _reason);

    (uint256 against,,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(against, _amount, "Votes against are not correct");
  }

  function testFuzz_CorrectlyCastVoteFor(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReason(_proposalId, uint8(SpokeCountingFractional.VoteType.For), _reason);

    (, uint256 forVotes,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(forVotes, _amount, "Votes for are not correct");
  }

  function testFuzz_CorrectlyCastVoteAbstain(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReason(_proposalId, uint8(SpokeCountingFractional.VoteType.Abstain), _reason);

    (,, uint256 abstain) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(abstain, _amount, "Abstained votes are not correct");
  }

  function testFuzz_EmitsVoteCast(
    uint128 _amount,
    uint256 _proposalId,
    uint8 _support,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.expectEmit();
    emit SpokeVoteAggregator.VoteCast(_caller, _proposalId, _support, _amount, _reason);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReason(_proposalId, _support, _reason);
  }

  function testFuzz_RevertWhen_BeforeProposalStart(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_caller != address(0));

    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart - 1);
    vm.prank(_caller);
    vm.expectRevert(SpokeVoteAggregator.ProposalInactive.selector);
    spokeVoteAggregator.castVoteWithReason(_proposalId, _support, _reason);
  }

  function testFuzz_RevertWhen_VoterHasAlreadyVoted(
    uint128 _amount,
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));

    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    _support = uint8(bound(_support, 0, 2));
    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    vm.startPrank(_caller);
    spokeVoteAggregator.castVoteWithReason(_proposalId, _support, _reason);

    vm.expectRevert("SpokeCountingFractional: all weight cast");
    spokeVoteAggregator.castVoteWithReason(_proposalId, _support, _reason);
    vm.stopPrank();
  }

  function testFuzz_RevertWhen_InvalidVoteType(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    uint8 _invalidVoteType
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));

    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    vm.assume(_invalidVoteType != 0 && _invalidVoteType != 1 && _invalidVoteType != 2);
    vm.expectRevert("SpokeCountingFractional: invalid support value, must be included in VoteType enum");
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReason(_proposalId, _invalidVoteType, _reason);
  }

  function testFuzz_RevertIf_CallerHasNoWeight(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(SpokeVoteAggregator.NoWeight.selector));
    spokeVoteAggregator.castVoteWithReason(_proposalId, _support, _reason);
  }
}

contract CastVoteWithReasonAndParams is SpokeVoteAggregatorTest {
  function _assertVotesEq(
    uint256 _proposalId,
    uint128 _totalVotes,
    uint128 _againstVotes,
    uint128 _forVotes,
    uint128 _abstainVotes
  ) internal view {
    (uint256 against, uint256 forVotes, uint256 abstain) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(against, _againstVotes, "Votes against are not correct");
    assertEq(forVotes, _forVotes, "Votes for are not correct");
    assertEq(abstain, _abstainVotes, "Abstained votes are not correct");
    assertEq(against + forVotes + abstain, _totalVotes, "Total votes should equal the total weight");
  }

  function testFuzz_CorrectlyCastVoteAgainst(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);
    bytes memory _params = _getVoteData(SpokeCountingFractional.ProposalVote(_amount, 0, 0));

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReasonAndParams(
      _proposalId, uint8(SpokeCountingFractional.VoteType.Against), _reason, _params
    );

    (uint256 against,,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(against, _amount, "Votes against are not correct");
  }

  function testFuzz_CorrectlyCastVoteFor(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);
    bytes memory _params = _getVoteData(SpokeCountingFractional.ProposalVote(0, _amount, 0));

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReasonAndParams(
      _proposalId, uint8(SpokeCountingFractional.VoteType.For), _reason, _params
    );

    (, uint256 forVotes,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(forVotes, _amount, "Votes for are not correct");
  }

  function testFuzz_CorrectlyCastVoteAbstain(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason
  ) public {
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);
    bytes memory _params = _getVoteData(SpokeCountingFractional.ProposalVote(0, 0, _amount));

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReasonAndParams(
      _proposalId, uint8(SpokeCountingFractional.VoteType.Abstain), _reason, _params
    );

    (,, uint256 abstain) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(abstain, _amount, "Abstained votes are not correct");
  }

  function testFuzz_EmitsVoteCastWithParams(
    uint256 _proposalId,
    uint8 _support,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    vm.assume(_caller != address(0));
    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);
    bytes memory _params = _getVoteData(_votes);
    uint256 _totalWeight = _getTotalWeight(_votes);
    vm.assume(_totalWeight != 0);

    deal(address(token), _caller, _totalWeight);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.expectEmit();
    emit SpokeVoteAggregator.VoteCastWithParams(_caller, _proposalId, _support, _totalWeight, _reason, _params);
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReasonAndParams(_proposalId, _support, _reason, _params);
  }

  function testFuzz_CorrectlyCastMultipleVotes(
    uint128 _totalVotes,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    SpokeCountingFractional.ProposalVote memory _vote1
  ) public {
    SpokeCountingFractional.ProposalVote memory _vote2;

    vm.assume(_totalVotes != 0);
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    // Ensure vote1 votes don't exceed total votes
    _vote1.againstVotes = uint128(bound(_vote1.againstVotes, 0, _totalVotes));
    _vote1.forVotes = uint128(bound(_vote1.forVotes, 0, _totalVotes - _vote1.againstVotes));
    _vote1.abstainVotes = uint128(bound(_vote1.abstainVotes, 0, _totalVotes - _vote1.againstVotes - _vote1.forVotes));

    uint128 vote1Total = _vote1.againstVotes + _vote1.forVotes + _vote1.abstainVotes;
    uint128 remainingVotes = _totalVotes - vote1Total;

    // Ensure vote2 votes don't exceed remaining votes
    _vote2.againstVotes = uint128(bound(_vote2.againstVotes, 0, remainingVotes));
    _vote2.forVotes = uint128(bound(_vote2.forVotes, 0, remainingVotes - _vote2.againstVotes));
    _vote2.abstainVotes = remainingVotes - _vote2.againstVotes - _vote2.forVotes;

    uint128 vote2Total = _vote2.againstVotes + _vote2.forVotes + _vote2.abstainVotes;
    vm.assume(vote2Total != 0); // Ensure vote2 votes are not all 0 to prevent an "all weight cast" revert

    deal(address(token), _caller, _totalVotes);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);
    vm.warp(_voteStart + 1);

    vm.startPrank(_caller);

    spokeVoteAggregator.castVoteWithReasonAndParams(
      _proposalId,
      0, // unused support param when fractional voting
      _reason,
      _getVoteData(_vote1)
    );

    spokeVoteAggregator.castVoteWithReasonAndParams(
      _proposalId,
      0, // unused support param when fractional voting
      _reason,
      _getVoteData(_vote2)
    );

    vm.stopPrank();

    _assertVotesEq(
      _proposalId,
      _totalVotes,
      _vote1.againstVotes + _vote2.againstVotes,
      _vote1.forVotes + _vote2.forVotes,
      _vote1.abstainVotes + _vote2.abstainVotes
    );
  }

  function testFuzz_RevertWhen_BeforeProposalStart(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    vm.assume(_caller != address(0));

    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);
    bytes memory _params = _getVoteData(_votes);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart - 1);
    vm.prank(_caller);
    vm.expectRevert(SpokeVoteAggregator.ProposalInactive.selector);
    spokeVoteAggregator.castVoteWithReasonAndParams(_proposalId, _support, _reason, _params);
  }

  function testFuzz_RevertWhen_VoterHasAlreadyVoted(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    vm.assume(_caller != address(0));

    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);
    bytes memory _params = _getVoteData(_votes);
    uint256 _totalWeight = _getTotalWeight(_votes);
    vm.assume(_totalWeight != 0);

    deal(address(token), _caller, _totalWeight);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    vm.startPrank(_caller);
    spokeVoteAggregator.castVoteWithReasonAndParams(_proposalId, _support, _reason, _params);

    vm.expectRevert("SpokeCountingFractional: all weight cast");
    spokeVoteAggregator.castVoteWithReasonAndParams(_proposalId, _support, _reason, _params);
    vm.stopPrank();
  }

  function testFuzz_RevertIf_InvalidVoteData(
    uint128 _amount,
    uint256 _proposalId,
    uint8 _support,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    bytes memory _params
  ) public {
    vm.assume(_params.length != 0 && _params.length != 48);
    vm.assume(_amount != 0);
    vm.assume(_caller != address(0));
    _support = uint8(bound(_support, 0, 2));
    _voteStart = _boundProposalTime(_voteStart);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    vm.expectRevert("SpokeCountingFractional: invalid voteData");
    vm.prank(_caller);
    spokeVoteAggregator.castVoteWithReasonAndParams(_proposalId, _support, _reason, _params);
  }

  function testFuzz_RevertIf_CallerHasNoWeight(
    uint8 _support,
    uint256 _proposalId,
    uint48 _voteStart,
    address _caller,
    string memory _reason,
    bytes memory _params
  ) public {
    vm.assume(_caller != address(0));
    _voteStart = _boundProposalTime(_voteStart);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(SpokeVoteAggregator.NoWeight.selector));
    spokeVoteAggregator.castVoteWithReasonAndParams(_proposalId, _support, _reason, _params);
  }
}

contract CastVoteBySig is SpokeVoteAggregatorTest {
  function generateSignature(
    uint256 _proposalId,
    uint8 _support,
    address _voter,
    uint256 _nonce,
    uint256 _voterPrivateKey
  ) public view returns (bytes memory) {
    bytes32 structHash =
      keccak256(abi.encode(spokeVoteAggregator.BALLOT_TYPEHASH(), _proposalId, _support, _voter, _nonce));
    bytes32 digest = spokeVoteAggregator.exposed_hashTypedDataV4(structHash);
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(_voterPrivateKey, digest);
    return abi.encodePacked(r, s, v);
  }

  function testFuzz_CorrectlyCastVoteBySigAgainst(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    string memory _callerName
  ) public {
    vm.assume(_amount != 0);
    _voteStart = _boundProposalTime(_voteStart);
    (address _caller, uint256 _callerPrivateKey) = makeAddrAndKey(_callerName);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    uint256 nonce = spokeVoteAggregator.nonces(_caller);
    uint8 _support = uint8(SpokeCountingFractional.VoteType.Against);
    bytes memory signature = generateSignature(_proposalId, _support, _caller, nonce, _callerPrivateKey);

    spokeVoteAggregator.castVoteBySig(_proposalId, _support, _caller, signature);

    (uint256 againstVotes,,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(againstVotes, _amount, "Against votes not counted correctly");
  }

  function testFuzz_CorrectlyCastVoteBySigFor(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    string memory _callerName
  ) public {
    vm.assume(_amount != 0);
    _voteStart = _boundProposalTime(_voteStart);
    (address _caller, uint256 _callerPrivateKey) = makeAddrAndKey(_callerName);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    uint256 nonce = spokeVoteAggregator.nonces(_caller);
    uint8 _support = uint8(SpokeCountingFractional.VoteType.For);
    bytes memory signature = generateSignature(_proposalId, _support, _caller, nonce, _callerPrivateKey);

    spokeVoteAggregator.castVoteBySig(_proposalId, _support, _caller, signature);

    (, uint256 forVotes,) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(forVotes, _amount, "For votes not counted correctly");
  }

  function testFuzz_CorrectlyCastVoteBySigAbstain(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    string memory _callerName
  ) public {
    vm.assume(_amount != 0);
    _voteStart = _boundProposalTime(_voteStart);
    (address _caller, uint256 _callerPrivateKey) = makeAddrAndKey(_callerName);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    uint256 nonce = spokeVoteAggregator.nonces(_caller);
    uint8 _support = uint8(SpokeCountingFractional.VoteType.Abstain);
    bytes memory signature = generateSignature(_proposalId, _support, _caller, nonce, _callerPrivateKey);

    spokeVoteAggregator.castVoteBySig(_proposalId, _support, _caller, signature);

    (,, uint256 abstainVotes) = spokeVoteAggregator.proposalVotes(_proposalId);
    assertEq(abstainVotes, _amount, "Abstain votes not counted correctly");
  }

  function testFuzz_RevertIf_InvalidSignature(
    uint128 _amount,
    uint256 _proposalId,
    uint48 _voteStart,
    string memory _callerName,
    bytes memory _invalidSignature
  ) public {
    vm.assume(_amount != 0);
    _voteStart = _boundProposalTime(_voteStart);
    (address _caller, uint256 _callerPrivateKey) = makeAddrAndKey(_callerName);

    deal(address(token), _caller, _amount);
    vm.prank(_caller);
    token.delegate(_caller);

    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + 1);

    uint256 nonce = spokeVoteAggregator.nonces(_caller);
    uint8 _support = uint8(SpokeCountingFractional.VoteType.For);
    bytes memory validSignature = generateSignature(_proposalId, _support, _caller, nonce, _callerPrivateKey);

    vm.assume(keccak256(_invalidSignature) != keccak256(validSignature));
    vm.expectRevert(abi.encodeWithSelector(SpokeVoteAggregator.InvalidSignature.selector, _caller));
    spokeVoteAggregator.castVoteBySig(_proposalId, _support, _caller, _invalidSignature);
  }
}

contract SetVoteWeightWindow is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyUpdateVoteWeightWindow(uint16 _window) public {
    vm.prank(owner);
    spokeVoteAggregator.setVoteWeightWindow(_window);

    uint48 setWindow = spokeVoteAggregator.getVoteWeightWindowLength(uint96(block.timestamp));
    assertEq(setWindow, _window);
  }

  function testFuzz_RevertIf_NotCalledByOwner(address _caller, uint16 _window) public {
    vm.assume(_caller != owner);

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    spokeVoteAggregator.setVoteWeightWindow(_window);
  }
}

contract VoteActiveInternal is SpokeVoteAggregatorTest {
  function testFuzz_VoteActiveInternalBeforeStart(uint256 _proposalId, uint48 _voteStart) public {
    _voteStart = _boundProposalTime(_voteStart);
    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart - 1);
    assertFalse(spokeVoteAggregator.voteActiveInternal(_proposalId), "Vote should not be active before start");
  }

  function testFuzz_VoteActiveInternalAtStart(uint256 _proposalId, uint48 _voteStart) public {
    _voteStart = _boundProposalTime(_voteStart);
    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart);
    assertTrue(spokeVoteAggregator.voteActiveInternal(_proposalId), "Vote should be active at start");
  }

  function testFuzz_VoteActiveInternalAfterStart(uint256 _proposalId, uint48 _voteStart, uint48 _timeDelta) public {
    _voteStart = _boundProposalTime(_voteStart);
    _timeDelta = uint48(bound(_timeDelta, 1, type(uint48).max - _voteStart));
    spokeMetadataCollector.workaround_createProposal(_proposalId, _voteStart);

    vm.warp(_voteStart + _timeDelta);
    assertTrue(spokeVoteAggregator.voteActiveInternal(_proposalId), "Vote should be active after start");
  }
}

contract Token is Test {
  function testFuzz_CorrectlyGetToken(
    address _token,
    address _spokeMetadataCollector,
    address _owner,
    uint16 _voteWeightWindow
  ) public {
    vm.assume(_owner != address(0));
    SpokeVoteAggregator spokeVoteAggregator =
      new SpokeVoteAggregator(_spokeMetadataCollector, _token, _owner, _voteWeightWindow);
    assertEq(address(spokeVoteAggregator.token()), _token);
  }
}

contract GetVotes is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyGetVotes(address _account, uint128 _voteWeight) public {
    vm.assume(_account != address(0));
    vm.assume(_voteWeight > 0);

    deal(address(token), _account, _voteWeight);
    vm.prank(_account);
    token.delegate(_account);

    uint48 windowLength = spokeVoteAggregator.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    uint256 windowStart = vm.getBlockTimestamp() + windowLength;
    vm.warp(windowStart);

    uint256 voteWeight = spokeVoteAggregator.getVotes(_account, vm.getBlockTimestamp());
    assertEq(voteWeight, _voteWeight, "Vote weight should be correct");
  }
}
