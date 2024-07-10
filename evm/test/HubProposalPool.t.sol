// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {EmptyWormholeAddress} from "wormhole/query/QueryResponse.sol";

import {HubProposalPool} from "src/HubProposalPool.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";

contract HubProposalPoolTest is WormholeEthQueryTest, AddressUtils, ProposalTest {
  HubProposalPool public hubProposalPool;
  HubGovernorHarness public hubGovernor;
  HubVotePool public hubVotePool;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;

  uint48 public constant INITIAL_VOTING_DELAY = 1 days;
  uint32 public constant INITIAL_VOTING_PERIOD = 1 days;
  uint208 public constant INITIAL_QUORUM = 100e18;
  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;
  uint48 public constant VOTE_WINDOW = 1 days;

  struct VoteWeight {
    uint256 voteWeight;
    uint16 chainId;
    address tokenAddress;
  }

  function setUp() public {
    _setupWormhole();

    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();

    hubVotePool = new HubVotePool(address(wormhole), initialOwner, new HubVotePool.SpokeVoteAggregator[](1));

    hubGovernor = new HubGovernorHarness(
      "Example Gov",
      token,
      timelock,
      INITIAL_VOTING_DELAY,
      INITIAL_VOTING_PERIOD,
      PROPOSAL_THRESHOLD,
      INITIAL_QUORUM,
      address(hubVotePool),
      VOTE_WINDOW
    );

    hubProposalPool = new HubProposalPool(address(wormhole), address(hubGovernor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(hubGovernor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(hubGovernor));

    vm.prank(initialOwner);
    hubVotePool.transferOwnership(address(hubGovernor));
  }

  function _mockQueryResponse(VoteWeight[] memory voteWeights, address proposer) internal view returns (bytes memory) {
    bytes memory queryRequestBytes = "";
    bytes memory perChainResponses = "";

    for (uint256 i = 0; i < voteWeights.length; i++) {
      uint256 voteWeight = voteWeights[i].voteWeight;
      uint16 chainId = voteWeights[i].chainId;
      address tokenAddress = voteWeights[i].tokenAddress;

      bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
        bytes("0x1296c33"),
        1,
        QueryTest.buildEthCallDataBytes(
          tokenAddress, abi.encodeWithSignature("getVotes(address,uint256)", proposer, block.number)
        )
      );

      queryRequestBytes = abi.encodePacked(
        queryRequestBytes, QueryTest.buildPerChainRequestBytes(chainId, hubProposalPool.QT_ETH_CALL(), ethCall)
      );

      bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
        uint64(block.number),
        blockhash(block.number),
        uint64(block.timestamp),
        1,
        QueryTest.buildEthCallResultBytes(abi.encode(voteWeight))
      );

      perChainResponses = abi.encodePacked(
        perChainResponses, QueryTest.buildPerChainResponseBytes(chainId, hubProposalPool.QT_ETH_CALL(), ethCallResp)
      );
    }

    bytes memory response = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      QueryTest.buildOffChainQueryRequestBytes(VERSION, 0, uint8(voteWeights.length), queryRequestBytes),
      uint8(voteWeights.length),
      perChainResponses
    );

    return response;
  }

  function _getSignatures(bytes memory response) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(response, address(hubProposalPool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }

  function _createProposal(bytes memory callData) internal returns (ProposalBuilder) {
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(hubGovernor), 0, callData);
    return builder;
  }

  function _mintAndDelegate(address user, uint256 _amount) public returns (address) {
    token.mint(user, _amount);
    vm.prank(user);
    token.delegate(user);
    vm.warp(vm.getBlockTimestamp() + 1);
    return user;
  }

  function _createArbitraryProposal() internal returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", 100));
  }
}

contract Constructor is Test {
  function testFuzz_CorrectlySetConstructorArgs(address _core, address _hubGovernor) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));

    HubProposalPool hubProposalPool = new HubProposalPool(_core, _hubGovernor);
    assertEq(address(hubProposalPool.WORMHOLE_CORE()), _core);
    assertEq(address(hubProposalPool.HUB_GOVERNOR()), _hubGovernor);
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(address _hubGovernor) public {
    vm.expectRevert(EmptyWormholeAddress.selector);
    new HubProposalPool(address(0), _hubGovernor);
  }

  function testFuzz_RevertIf_HubGovernorIsZeroAddress(address _core) public {
    vm.assume(_core != address(0));
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new HubProposalPool(_core, address(0));
  }
}

contract CheckAndProposeIfEligible is HubProposalPoolTest {
  function _getFirstNItems(VoteWeight[] memory array, uint256 n) internal pure returns (VoteWeight[] memory) {
    uint256 length = n < array.length ? n : array.length;
    VoteWeight[] memory result = new VoteWeight[](length);
    for (uint256 i = 0; i < length; i++) {
      result[i] = array[i];
    }
    return result;
  }

  function _boundVoteWeight(uint256 voteWeight) internal pure returns (uint256) {
    return voteWeight > type(uint128).max ? type(uint128).max : voteWeight;
  }

  function _boundVoteWeights(VoteWeight[] memory voteWeights) internal pure returns (VoteWeight[] memory) {
    VoteWeight[] memory result = new VoteWeight[](voteWeights.length);
    for (uint256 i = 0; i < voteWeights.length; i++) {
      result[i] = VoteWeight({
        voteWeight: _boundVoteWeight(voteWeights[i].voteWeight),
        chainId: voteWeights[i].chainId,
        tokenAddress: voteWeights[i].tokenAddress
      });
    }
    return result;
  }

  function _ensureUniqueChainIds(VoteWeight[] memory voteWeights) internal pure returns (VoteWeight[] memory) {
    uint16 lastChainId = 0;
    for (uint256 i = 0; i < voteWeights.length; i++) {
      if (voteWeights[i].chainId <= lastChainId) voteWeights[i].chainId = uint16(lastChainId + 1);
      lastChainId = voteWeights[i].chainId;
    }
    return voteWeights;
  }

  function _ensureUniqueTokenAddresses(VoteWeight[] memory voteWeights) internal returns (VoteWeight[] memory) {
    for (uint256 i = 0; i < voteWeights.length; i++) {
      address tokenAddress =
        voteWeights[i].tokenAddress == address(0) ? address(new ERC20VotesFake()) : voteWeights[i].tokenAddress;
      voteWeights[i].tokenAddress = tokenAddress;
    }
    return voteWeights;
  }

  function _setTokenAddresses(VoteWeight[] memory voteWeights) internal {
    for (uint256 i = 0; i < voteWeights.length; i++) {
      vm.prank(hubProposalPool.owner());
      hubProposalPool.setTokenAddress(voteWeights[i].chainId, voteWeights[i].tokenAddress);
    }
  }

  function _checkThresholdMet(VoteWeight[] memory voteWeights, uint256 hubVoteWeight, uint256 threshold)
    internal
    pure
    returns (bool)
  {
    if (hubVoteWeight >= threshold) return true;

    uint256 remainingThreshold = threshold - hubVoteWeight;
    uint256 accumulator = 0;

    for (uint256 i = 0; i < voteWeights.length; i++) {
      accumulator += voteWeights[i].voteWeight;
      if (accumulator >= remainingThreshold) return true;
    }

    return false;
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligible(
    VoteWeight[] memory _voteWeights,
    uint256 _hubVoteWeight,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_caller != address(0));
    uint8 numWeightsToUse = 3;
    VoteWeight[] memory truncatedVoteWeights = _getFirstNItems(_voteWeights, numWeightsToUse);
    truncatedVoteWeights = _boundVoteWeights(truncatedVoteWeights);
    truncatedVoteWeights = _ensureUniqueChainIds(truncatedVoteWeights);

    _hubVoteWeight = bound(_hubVoteWeight, 1, PROPOSAL_THRESHOLD);

    hubGovernor.exposed_setWhitelistedProposer(address(hubProposalPool));

    _mintAndDelegate(_caller, _hubVoteWeight);

    truncatedVoteWeights = _ensureUniqueTokenAddresses(truncatedVoteWeights);
    _setTokenAddresses(truncatedVoteWeights);

    vm.assume(_checkThresholdMet(truncatedVoteWeights, _hubVoteWeight, PROPOSAL_THRESHOLD));

    bytes memory queryResponse = _mockQueryResponse(truncatedVoteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    // Need to warp past the window if the current timestamp is less than the vote weight window length
    uint48 windowLength = hubGovernor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));

    vm.warp(vm.getBlockTimestamp() + windowLength);

    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_caller);
    uint256 proposalId = hubProposalPool.checkAndProposeIfEligible(
      builder.targets(), builder.values(), builder.calldatas(), _description, queryResponse, signatures
    );
    vm.stopPrank();

    // Use proposal snapshot func to get expected vote start
    assertTrue(proposalId > 0, "Proposal should be created");
  }

  // function testFuzz_RevertIf_InsufficientVoteWeight(uint256[] memory voteWeights, uint16[] memory chainIds) public {
  //   vm.assume(voteWeights.length == chainIds.length);
  //   vm.assume(voteWeights.length > 0 && voteWeights.length <= 5);

  //   uint256 totalVoteWeight = 0;
  //   for (uint256 i = 0; i < voteWeights.length; i++) {
  //     totalVoteWeight += voteWeights[i];
  //     vm.assume(chainIds[i] != 0);
  //   }

  //   vm.assume(totalVoteWeight < PROPOSAL_THRESHOLD);

  //   bytes memory queryResponse = _mockQueryResponse(voteWeights, chainIds, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createArbitraryProposal();
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(HubProposalPool.InsufficientVoteWeight.selector);
  //   hubProposalPool.checkAndProposeIfEligible(
  //     builder.targets(), builder.values(), builder.calldatas(), description, queryResponse, signatures
  //   );
  // }

  // function testFuzz_RevertIf_InvalidProposalLength() public {
  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createProposal(hex"");
  //   builder.push(address(0x456), 2 ether, hex""); // Adding extra data to mismatch length
  //   address[] memory targets = builder.targets();
  //   uint256[] memory values = new uint256[](1); // Mismatched length
  //   bytes[] memory calldatas = builder.calldatas();
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(HubProposalPool.InvalidProposalLength.selector);
  //   hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, description, queryResponse, signatures);
  // }

  // function testFuzz_RevertIf_EmptyProposal() public {
  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   address[] memory targets = new address[](0);
  //   uint256[] memory values = new uint256[](0);
  //   bytes[] memory calldatas = new bytes[](0);
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(HubProposalPool.EmptyProposal.selector);
  //   hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, description, queryResponse, signatures);
  // }

  // function testFuzz_RevertIf_NotCalledByOwner(address _caller) public {
  //   vm.assume(_caller != address(0));
  //   vm.assume(_caller != address(hubProposalPool.owner()));

  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createArbitraryProposal();
  //   address[] memory targets = builder.targets();
  //   uint256[] memory values = builder.values();
  //   bytes[] memory calldatas = builder.calldatas();
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
  //   vm.prank(_caller);
  //   hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, description, queryResponse, signatures);
  // }

  // function testFuzz_EmitsProposalCreatedEvent() public {
  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createArbitraryProposal();
  //   string memory description = "Test Proposal";

  //   vm.expectEmit();
  //   emit HubProposalPool.ProposalCreated(1); // Assuming first proposal ID is 1

  //   hubProposalPool.checkAndProposeIfEligible(
  //     builder.targets(), builder.values(), builder.calldatas(), description, queryResponse, signatures
  //   );
  // }
}
