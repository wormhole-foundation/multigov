  // SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {WormholeMock} from "wormhole-solidity-sdk/testing/helpers/WormholeMock.sol";

import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";

contract HubProposalMetadataTest is Test, ProposalTest {
  HubProposalMetadata public hubProposalMetadata;
  HubGovernorHarness public governor;
  ERC20VotesFake public token;

  function setUp() public {
    address initialOwner = makeAddr("Initial Owner");
    TimelockControllerFake timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();
    WormholeMock wormhole = new WormholeMock();
    HubVotePool hubVotePool = new HubVotePool(address(wormhole), initialOwner, new HubVotePool.SpokeVoteAggregator[](1));
    governor = new HubGovernorHarness(
      "Example Gov", token, timelock, 1 days, 1 days, 500_000e18, 100e18, address(hubVotePool), 1 days
    );

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(governor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(governor));

    hubProposalMetadata = new HubProposalMetadata(address(governor));
  }

  function _mintAndDelegate(address user, uint256 _amount) public returns (address) {
    token.mint(user, _amount);
    vm.prank(user);
    token.delegate(user);
    vm.warp(vm.getBlockTimestamp() + 1);
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

  function _createProposal(bytes memory _callData) public returns (ProposalBuilder) {
    // Warp to ensure we don't overlap with any minting and delegation
    vm.warp(block.timestamp + 7 days);
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(governor), 0, _callData);
    return builder;
  }

  function _createArbitraryProposal() public returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", 100));
  }
}

contract Constructor is HubProposalMetadataTest {
  function testFuzz_CorrectlySetConstructorArgs(address _governor) public {
    vm.assume(_governor != address(0));

    HubProposalMetadata hubProposalMetadata = new HubProposalMetadata(_governor);
    assertEq(address(hubProposalMetadata.GOVERNOR()), _governor);
  }
}

contract GetProposalMetadata is HubProposalMetadataTest {
  function testFuzz_CorrectlyGetProposalMetadata(string memory _proposalDescription) public {
    uint48 windowLength = governor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    vm.warp(vm.getBlockTimestamp() + windowLength);

    _setGovernorAndDelegates();
    ProposalBuilder builder = _createArbitraryProposal();

    uint256 _proposalId =
      _queueAndVoteAndExecuteProposal(builder.targets(), builder.values(), builder.calldatas(), _proposalDescription);

    (uint256 proposalId, uint256 voteStart) = hubProposalMetadata.getProposalMetadata(_proposalId);

    assertEq(proposalId, _proposalId);
    assertEq(voteStart, governor.proposalSnapshot(_proposalId));
  }
}
