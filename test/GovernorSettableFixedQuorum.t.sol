// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

import {GovernorSettableFixedQuorum} from "src/extensions/GovernorSettableFixedQuorum.sol";
import {HubGovernorTest} from "test/HubGovernor.t.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";

contract Quorum is HubGovernorTest {
  function testFuzz_SuccessfullyGetLatestQuorumCheckpoint(uint208 _quorum) public {
    governor.exposed_setQuorum(_quorum);
    uint256 quorum = governor.quorum(block.timestamp);
    assertEq(quorum, _quorum);
  }
}

contract SetQuorum is HubGovernorTest {
  function _createSetQuorumProposal(uint208 _quorum) public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", _quorum));
  }

  function testFuzz_CorrectlySetQuorumCheckpoint(uint208 _quorum) public {
    _setGovernorAndDelegates();
    vm.warp(block.timestamp + 7 days);
    ProposalBuilder builder = _createSetQuorumProposal(_quorum);
    _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), "Hi");
    assertEq(governor.quorum(block.timestamp), _quorum);
  }

  function testFuzz_SetMultipleQuorumValues(
    uint208 _firstQuorum,
    uint208 _secondQuorum,
    string memory _proposalDescriptionFirst,
    string memory _proposalDescriptionSecond
  ) public {
    // Quorum values must be uint128 because of the way _countVotes is implemented to handle overflow
    _firstQuorum = uint128(bound(_firstQuorum, 0, type(uint128).max - 1));
    _secondQuorum = uint128(bound(_secondQuorum, 0, type(uint128).max - 1));

    _setGovernorAndDelegates();

    ProposalBuilder firstBuilder = _createSetQuorumProposal(_firstQuorum);
    _queueAndVoteAndExecuteProposal(
      firstBuilder.targets(), firstBuilder.values(), firstBuilder.calldatas(), _proposalDescriptionFirst
    );
    assertEq(governor.quorum(block.timestamp), _firstQuorum);

    ProposalBuilder secondBuilder = _createSetQuorumProposal(_secondQuorum);

    // Mint and delegate to the first delegate an amount to pass the first quorum
    _mintAndDelegate(delegates[0], _firstQuorum);
    _queueAndVoteAndExecuteProposal(
      secondBuilder.targets(), secondBuilder.values(), secondBuilder.calldatas(), _proposalDescriptionSecond
    );
    assertEq(governor.quorum(block.timestamp), _secondQuorum);
  }

  function testFuzz_EmitsQuorumUpdatedEvent(uint208 _quorum, string memory _proposalDescription) public {
    vm.assume(_quorum != 0);

    _setGovernorAndDelegates();

    ProposalBuilder builder = _createSetQuorumProposal(_quorum);
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(delegates[0]);
    uint256 _proposalId = governor.propose(targets, values, calldatas, _proposalDescription);

    _jumpToActiveProposal(_proposalId);

    _delegatesVote(_proposalId, 1);
    _jumpPastVoteComplete(_proposalId);

    governor.queue(targets, values, calldatas, keccak256(bytes(_proposalDescription)));

    _jumpPastProposalEta(_proposalId);

    vm.expectEmit();
    emit GovernorSettableFixedQuorum.QuorumUpdated(governor.quorum(block.timestamp), _quorum);
    governor.execute(targets, values, calldatas, keccak256(bytes(_proposalDescription)));
  }

  function testFuzz_RevertIf_CallerIsNotAuthorized(uint208 _quorum, address _caller) public {
    // Timelock will trigger a different error
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, _caller));
    governor.setQuorum(_quorum);
  }
}
