// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {WormholeMock} from "wormhole-solidity-sdk/testing/helpers/WormholeMock.sol";
import {Test, console2} from "forge-std/Test.sol";

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
    spokeVoteAggregator =
      new SpokeVoteAggregatorHarness(address(spokeMetadataCollector), address(token), 1 days, owner, 1 days);
  }

  function _boundProposalTime(uint48 _voteStart) internal pure returns (uint48) {
    _voteStart = uint48(bound(_voteStart, 1, type(uint48).max - 2));
    return _voteStart;
  }
}

contract Constructor is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlySetConstructorArgs(
    address _token,
    uint32 _safeWindow,
    address _spokeMetadataCollector,
    address _owner,
    uint48 _voteWeightWindow
  ) public {
    vm.assume(_owner != address(0));
    SpokeVoteAggregator spokeVoteAggregator =
      new SpokeVoteAggregator(_spokeMetadataCollector, _token, _safeWindow, _owner, _voteWeightWindow);
    assertEq(address(spokeVoteAggregator.VOTING_TOKEN()), _token);
    assertEq(address(spokeVoteAggregator.spokeMetadataCollector()), _spokeMetadataCollector);
  }
}

contract CastVote is SpokeVoteAggregatorTest {
  function testFuzz_CorrectlyCastVoteAgainst(uint128 _amount, uint256 _proposalId, uint48 _voteStart, address _caller)
    public
  {
    vm.assume(_amount != 0);
    vm.assume(_proposalId != 0);
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
    vm.assume(_proposalId != 0);
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
    vm.assume(_proposalId != 0);
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
    vm.assume(_proposalId != 0);
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
    vm.assume(_proposalId != 0);
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
