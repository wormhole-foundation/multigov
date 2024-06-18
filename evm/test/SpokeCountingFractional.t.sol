// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpokeCountingFractionalHarness} from "test/harnesses/SpokeCountingFractionalHarness.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";

contract SpokeCountingFractionalTest is Test {
  SpokeCountingFractionalHarness spokeCountingFractional;

  function setUp() public {
    spokeCountingFractional = new SpokeCountingFractionalHarness();
  }

  function _getVoteData(SpokeCountingFractional.ProposalVote memory _votes)
    internal
    pure
    returns (bytes memory, uint256)
  {
    _votes.againstVotes = uint128(bound(_votes.againstVotes, 0, type(uint128).max / 3));
    _votes.forVotes = uint128(bound(_votes.forVotes, 0, type(uint128).max / 3));
    _votes.abstainVotes = uint128(bound(_votes.abstainVotes, 0, type(uint128).max / 3));

    bytes memory _voteData =
      abi.encodePacked(uint128(_votes.againstVotes), uint128(_votes.forVotes), uint128(_votes.abstainVotes));

    uint256 _totalWeight = uint256(_votes.againstVotes) + uint256(_votes.forVotes) + uint256(_votes.abstainVotes);
    _totalWeight = bound(_totalWeight, 1, type(uint128).max);

    return (_voteData, _totalWeight);
  }
}

contract COUNTING_MODE is SpokeCountingFractionalTest {
  function test_CorrectlyGetCountingMode() public view {
    assertEq(spokeCountingFractional.COUNTING_MODE(), "support=bravo&quorum=for,abstain&params=fractional");
  }
}

contract HasVoted is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyGetHasVoted(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    _support = uint8(bound(_support, 0, 2));
    (bytes memory _voteData, uint256 _totalWeight) = _getVoteData(_votes);

    assertEq(spokeCountingFractional.hasVoted(_proposalId, _account), false);

    spokeCountingFractional.workaround_createProposalVote(_proposalId, _account, _support, _totalWeight, _voteData);

    assertEq(spokeCountingFractional.hasVoted(_proposalId, _account), true);
  }
}

contract VoteWeightCast is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyGetVoteWeightCast(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    _support = uint8(bound(_support, 0, 2));
    (bytes memory _voteData, uint256 _totalWeight) = _getVoteData(_votes);

    assertEq(spokeCountingFractional.voteWeightCast(_proposalId, _account), 0);

    spokeCountingFractional.workaround_createProposalVote(_proposalId, _account, _support, _totalWeight, _voteData);

    assertEq(spokeCountingFractional.voteWeightCast(_proposalId, _account), _totalWeight);
  }
}

contract ProposalVotes is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyGetProposalVotes(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    _support = uint8(bound(_support, 0, 2));

    (bytes memory _voteData, uint256 _totalWeight) = _getVoteData(_votes);

    spokeCountingFractional.workaround_createProposalVote(_proposalId, _account, _support, _totalWeight, _voteData);

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = spokeCountingFractional.proposalVotes(_proposalId);

    assertEq(againstVotes, _votes.againstVotes);
    assertEq(forVotes, _votes.forVotes);
    assertEq(abstainVotes, _votes.abstainVotes);
  }
}

contract _CountVote is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyCountVote(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    _support = uint8(bound(_support, 0, 2));

    (bytes memory _voteData, uint256 _totalWeight) = _getVoteData(_votes);

    spokeCountingFractional.exposed_countVote(_proposalId, _account, _support, _totalWeight, _voteData);

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = spokeCountingFractional.proposalVotes(_proposalId);

    assertEq(againstVotes, _votes.againstVotes);
    assertEq(forVotes, _votes.forVotes);
    assertEq(abstainVotes, _votes.abstainVotes);
  }

  function testFuzz_RevertIf_TotalWeightIsZero(uint256 _proposalId, address _account, uint8 _support) public {
    _support = uint8(bound(_support, 0, 2));

    uint128 ZERO_TOTAL_WEIGHT = 0;

    bytes memory _arbitraryVoteData = "";

    vm.expectRevert("SpokeCountingFractional: no weight");
    spokeCountingFractional.exposed_countVote(_proposalId, _account, _support, ZERO_TOTAL_WEIGHT, _arbitraryVoteData);
  }

  function testFuzz_RevertIf_HasAlreadyVotedWithItsWeight(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    _support = uint8(bound(_support, 0, 2));
    (bytes memory _voteData, uint256 _totalWeight) =
      _getVoteData(SpokeCountingFractional.ProposalVote(_votes.againstVotes, _votes.forVotes, _votes.abstainVotes));

    uint128 TOTAL_WEIGHT_LESS_THAN_CAST = uint128(_totalWeight - 1);

    spokeCountingFractional.workaround_createProposalVote(_proposalId, _account, _support, _totalWeight, _voteData);

    vm.expectRevert("SpokeCountingFractional: all weight cast");
    spokeCountingFractional.exposed_countVote(_proposalId, _account, _support, TOTAL_WEIGHT_LESS_THAN_CAST, _voteData);
  }
}

contract _CountVoteNominal is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyCountVoteNominal(
    uint256 _proposalId,
    address _account,
    uint8 _support,
    uint128 _totalWeight
  ) public {
    // Ensure support is within the valid range
    _support = uint8(bound(_support, 0, 2));

    vm.assume(_totalWeight != 0);

    spokeCountingFractional.exposed_countVoteNominal(_proposalId, _account, _totalWeight, _support);

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = spokeCountingFractional.proposalVotes(_proposalId);

    if (_support == uint8(SpokeCountingFractional.VoteType.Against)) assertEq(againstVotes, _totalWeight);
    else if (_support == uint8(SpokeCountingFractional.VoteType.For)) assertEq(forVotes, _totalWeight);
    else if (_support == uint8(SpokeCountingFractional.VoteType.Abstain)) assertEq(abstainVotes, _totalWeight);
  }

  function testFuzz_RevertIf_VoteExceedsWeight(
    uint256 _proposalId,
    address _account,
    uint128 _initialWeight,
    uint128 _additionalWeight,
    uint8 _support
  ) public {
    // Ensure support is within the valid range
    _support = uint8(bound(_support, 0, 2));

    _initialWeight = uint128(bound(_initialWeight, 1, type(uint128).max / 2));
    _additionalWeight = uint128(bound(_additionalWeight, 1, type(uint128).max / 2));

    spokeCountingFractional.exposed_countVoteNominal(_proposalId, _account, _initialWeight, _support);

    vm.expectRevert("SpokeCountingFractional: vote would exceed weight");
    spokeCountingFractional.exposed_countVoteNominal(_proposalId, _account, _additionalWeight, _support);
  }

  function testRevert_IfInvalidSupportValue(
    uint256 _proposalId,
    address _account,
    uint128 _totalWeight,
    uint8 _invalidSupport
  ) public {
    _invalidSupport = uint8(bound(_invalidSupport, 3, 255));

    _totalWeight = uint128(bound(_totalWeight, 1, type(uint128).max));

    vm.expectRevert("SpokeCountingFractional: invalid support value, must be included in VoteType enum");
    spokeCountingFractional.exposed_countVoteNominal(_proposalId, _account, _totalWeight, _invalidSupport);
  }
}

contract _CountVoteFractional is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyCountVoteFractional(
    uint256 _proposalId,
    address _account,
    SpokeCountingFractional.ProposalVote memory _votes
  ) public {
    (bytes memory _voteData, uint256 _totalWeight) = _getVoteData(_votes);

    spokeCountingFractional.exposed_countVoteFractional(_proposalId, _account, uint128(_totalWeight), _voteData);

    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = spokeCountingFractional.proposalVotes(_proposalId);

    assertEq(againstVotes, _votes.againstVotes);
    assertEq(forVotes, _votes.forVotes);
    assertEq(abstainVotes, _votes.abstainVotes);
  }

  function testFuzz_RevertIf_InvalidVoteData(uint256 _proposalId, address _account, uint128 _totalWeight) public {
    // Create invalid vote data (not 48 bytes)
    bytes memory invalidVoteData = abi.encodePacked(uint128(100), uint128(200));

    // Expect revert when casting vote with invalid vote data
    vm.expectRevert("SpokeCountingFractional: invalid voteData");
    spokeCountingFractional.exposed_countVoteFractional(_proposalId, _account, _totalWeight, invalidVoteData);
  }

  function testFuzz_RevertIf_VoteExceedsWeight(
    uint256 _proposalId,
    address _account,
    SpokeCountingFractional.ProposalVote memory _initialVotes,
    SpokeCountingFractional.ProposalVote memory _additionalVotes
  ) public {
    (bytes memory _initialVoteData, uint256 _initialTotalWeight) = _getVoteData(_initialVotes);

    spokeCountingFractional.exposed_countVoteFractional(
      _proposalId, _account, uint128(_initialTotalWeight), _initialVoteData
    );

    (bytes memory _additionalVoteData,) = _getVoteData(_additionalVotes);

    // Use the same total weight for both votes to ensure the second vote exceeds the weight
    uint128 totalAllowedWeight = uint128(_initialTotalWeight);

    vm.expectRevert("SpokeCountingFractional: vote would exceed weight");
    spokeCountingFractional.exposed_countVoteFractional(_proposalId, _account, totalAllowedWeight, _additionalVoteData);
  }
}

contract _DecodePackedVotes is SpokeCountingFractionalTest {
  function testFuzz_CorrectlyDecodePackedVotes(uint128 _againstVotes, uint128 _forVotes, uint128 _abstainVotes)
    public
    view
  {
    bytes memory _voteData = abi.encodePacked(_againstVotes, _forVotes, _abstainVotes);

    (uint128 decodedAgainstVotes, uint128 decodedForVotes, uint128 decodedAbstainVotes) =
      spokeCountingFractional.exposed_decodePackedVotes(_voteData);

    assertEq(decodedAgainstVotes, _againstVotes);
    assertEq(decodedForVotes, _forVotes);
    assertEq(decodedAbstainVotes, _abstainVotes);
  }
}
