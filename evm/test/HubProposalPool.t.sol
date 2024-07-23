// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {EmptyWormholeAddress} from "wormhole/query/QueryResponse.sol";

import {HubProposalPool} from "src/HubProposalPool.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubGovernorProposalExtender} from "src/HubGovernorProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalPoolHarness} from "test/harnesses/HubProposalPoolHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";

contract HubProposalPoolTest is WormholeEthQueryTest, AddressUtils, ProposalTest {
  HubProposalPoolHarness public hubProposalPool;
  HubGovernorHarness public hubGovernor;
  HubVotePool public hubVotePool;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubGovernorProposalExtender public extender;

  uint48 public constant INITIAL_VOTING_DELAY = 1 days;
  uint32 public constant INITIAL_VOTING_PERIOD = 1 days;
  uint208 public constant INITIAL_QUORUM = 100e18;
  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;
  uint48 public constant VOTE_WINDOW = 1 days;
  uint8 public constant NUM_WEIGHTS_TO_USE = 3;

  uint48 VOTE_TIME_EXTENSION = 1 days;
  uint48 MINIMUM_VOTE_EXTENSION = 1 hours;
  uint32 SAFE_WINDOW = 1 days;
  uint48 MINIMUM_DESCISION_WINDOW = 1 hours;

  struct VoteWeight {
    uint256 voteWeight;
    uint16 chainId;
    address spokeAddress;
  }

  function setUp() public {
    _setupWormhole();

    address initialOwner = makeAddr("Initial Owner");
    address whitelistedVoteExtender = makeAddr("Vote Extender");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();

    hubVotePool = new HubVotePool(address(wormhole), initialOwner, new HubVotePool.SpokeVoteAggregator[](1));

    extender = new HubGovernorProposalExtender(
      initialOwner, VOTE_TIME_EXTENSION, initialOwner, MINIMUM_VOTE_EXTENSION, SAFE_WINDOW, MINIMUM_DESCISION_WINDOW
    );

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: "Example Gov",
      token: token,
      timelock: timelock,
      initialVotingDelay: INITIAL_VOTING_DELAY,
      initialVotingPeriod: INITIAL_VOTING_PERIOD,
      initialProposalThreshold: PROPOSAL_THRESHOLD,
      initialQuorum: INITIAL_QUORUM,
      hubVotePool: address(hubVotePool),
      whitelistedVoteExtender: address(extender),
      initialVoteWindow: VOTE_WINDOW
    });

    hubGovernor = new HubGovernorHarness(params);

    hubProposalPool = new HubProposalPoolHarness(address(wormhole), address(hubGovernor));
    hubGovernor.exposed_setWhitelistedProposer(address(hubProposalPool));

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
      address spokeAddress = voteWeights[i].spokeAddress;

      bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
        bytes("0x1296c33"),
        1,
        QueryTest.buildEthCallDataBytes(spokeAddress, abi.encodeWithSignature("getVotes(address)", proposer))
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

  function _mockQueryResponseWithMultipleResults(
    uint16 _chainId,
    address _tokenAddress,
    address _caller,
    uint128 _voteWeight
  ) internal view returns (bytes memory) {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      2, // numCallData
      abi.encodePacked(
        QueryTest.buildEthCallDataBytes(_tokenAddress, abi.encodeWithSignature("getVotes(address)", _caller)),
        QueryTest.buildEthCallDataBytes(_tokenAddress, abi.encodeWithSignature("getVotes(address)", _caller))
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      abi.encodePacked(QueryTest.buildPerChainRequestBytes(_chainId, hubProposalPool.QT_ETH_CALL(), ethCall))
    );

    bytes memory invalidEthCallResp = abi.encodePacked(
      QueryTest.buildEthCallResultBytes(abi.encode(_voteWeight)),
      QueryTest.buildEthCallResultBytes(abi.encode(_voteWeight))
    );

    bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      2, // numResults
      invalidEthCallResp
    );

    return _buildQueryResponseWithMultipleResults(_chainId, _queryRequestBytes, ethCallResp);
  }

  function _buildQueryResponseWithMultipleResults(
    uint16 _chainId,
    bytes memory _queryRequestBytes,
    bytes memory _ethCallResp
  ) internal view returns (bytes memory) {
    return QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      _queryRequestBytes,
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(_chainId, hubProposalPool.QT_ETH_CALL(), _ethCallResp)
    );
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

  function _boundVoteWeight(uint256 voteWeight, uint256 maxVoteWeight) internal pure returns (uint256) {
    return voteWeight > maxVoteWeight ? maxVoteWeight : voteWeight;
  }

  function _boundVoteWeights(VoteWeight[] memory voteWeights) internal pure returns (VoteWeight[] memory) {
    uint256 remainingVoteWeight = type(uint128).max;
    VoteWeight[] memory result = new VoteWeight[](voteWeights.length);

    for (uint256 i = 0; i < voteWeights.length; i++) {
      if (remainingVoteWeight == 0) {
        result[i] =
          VoteWeight({voteWeight: 0, chainId: voteWeights[i].chainId, spokeAddress: voteWeights[i].spokeAddress});
      } else {
        uint256 boundedWeight = _boundVoteWeight(voteWeights[i].voteWeight, remainingVoteWeight);
        result[i] = VoteWeight({
          voteWeight: boundedWeight,
          chainId: voteWeights[i].chainId,
          spokeAddress: voteWeights[i].spokeAddress
        });
        remainingVoteWeight = remainingVoteWeight > boundedWeight ? remainingVoteWeight - boundedWeight : 0;
      }
    }
    return result;
  }

  function _ensureUniqueChainIds(VoteWeight[] memory voteWeights) internal pure returns (VoteWeight[] memory) {
    for (uint256 i = 0; i < voteWeights.length; i++) {
      voteWeights[i].chainId = uint16(i + 1);
    }
    return voteWeights;
  }

  function _ensureUniqueTokenAddresses(VoteWeight[] memory voteWeights) internal returns (VoteWeight[] memory) {
    for (uint256 i = 0; i < voteWeights.length; i++) {
      address spokeAddress =
        voteWeights[i].spokeAddress == address(0) ? address(new ERC20VotesFake()) : voteWeights[i].spokeAddress;
      voteWeights[i].spokeAddress = spokeAddress;
    }
    return voteWeights;
  }

  function _registerSpokes(VoteWeight[] memory voteWeights) internal {
    vm.startPrank(hubProposalPool.owner());
    for (uint256 i = 0; i < voteWeights.length; i++) {
      hubProposalPool.registerSpoke(voteWeights[i].chainId, voteWeights[i].spokeAddress);
    }
    vm.stopPrank();
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

  function _setupVoteWeights(VoteWeight[] memory voteWeights) internal returns (VoteWeight[] memory) {
    voteWeights = _boundVoteWeights(voteWeights);
    voteWeights = _ensureUniqueChainIds(voteWeights);
    voteWeights = _ensureUniqueTokenAddresses(voteWeights);
    _registerSpokes(voteWeights);
    return voteWeights;
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligibleSingleSpokeVoteWeight(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    vm.prank(hubProposalPool.owner());
    hubProposalPool.registerSpoke(_chainId, _spokeAddress);

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    bool thresholdMet = _checkThresholdMet(voteWeights, 0, hubGovernor.proposalThreshold());
    vm.assume(thresholdMet);

    uint48 windowLength = hubGovernor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    vm.warp(vm.getBlockTimestamp() + windowLength);

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_caller);
    uint256 proposalId = hubProposalPool.checkAndProposeIfEligible(
      builder.targets(), builder.values(), builder.calldatas(), _description, queryResponse, signatures
    );
    vm.stopPrank();

    assertTrue(proposalId > 0, "Proposal should be created");
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligible(
    VoteWeight[] memory _voteWeights,
    uint256 _hubVoteWeight,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_voteWeights.length > 0);
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    VoteWeight[] memory voteWeights = _setupVoteWeights(_voteWeights);

    _hubVoteWeight = bound(_hubVoteWeight, 1, PROPOSAL_THRESHOLD);
    _mintAndDelegate(_caller, _hubVoteWeight);

    bool thresholdMet = _checkThresholdMet(voteWeights, _hubVoteWeight, PROPOSAL_THRESHOLD);
    vm.assume(thresholdMet);

    uint48 windowLength = hubGovernor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    vm.warp(vm.getBlockTimestamp() + windowLength);

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_caller);
    uint256 proposalId = hubProposalPool.checkAndProposeIfEligible(
      builder.targets(), builder.values(), builder.calldatas(), _description, queryResponse, signatures
    );
    vm.stopPrank();

    // use snapshot to check that the proposal was created
    assertTrue(proposalId > 0, "Proposal should be created");
  }

  function testFuzz_RevertIf_InsufficientVoteWeight(string memory _description, address _caller) public {
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    // Create a vote weight with a below threshold total
    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold() - 1, chainId: 1, spokeAddress: address(token)});

    vm.prank(hubProposalPool.owner());
    hubProposalPool.registerSpoke(voteWeights[0].chainId, voteWeights[0].spokeAddress);

    uint48 windowLength = hubGovernor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    vm.warp(vm.getBlockTimestamp() + windowLength);

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(HubProposalPool.InsufficientVoteWeight.selector);
    vm.prank(_caller);
    hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, _description, queryResponse, signatures);
  }

  function testFuzz_RevertIf_InvalidCaller(
    VoteWeight[] memory _voteWeights,
    address _account,
    address _caller,
    string memory _description
  ) public {
    vm.assume(_voteWeights.length > 0);
    vm.assume(_account != address(0));
    vm.assume(_caller != address(0));
    vm.assume(_caller != _account);
    vm.assume(_caller != address(hubProposalPool.owner()));

    _voteWeights = _setupVoteWeights(_voteWeights);

    // Create mock query response with _account as the queried account
    bytes memory queryResponse = _mockQueryResponse(_voteWeights, _account);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(abi.encodeWithSelector(HubProposalPool.InvalidCaller.selector, _caller, _account));
    vm.prank(_caller);
    hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, _description, queryResponse, signatures);
  }

  function testFuzz_RevertIf_SpokeIsNotRegistered(
    uint128 _voteWeight,
    uint16 _chainId,
    address _caller,
    address _spokeAddress,
    string memory _description
  ) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0));

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: uint256(_voteWeight), chainId: _chainId, spokeAddress: _spokeAddress});

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(abi.encodeWithSelector(HubProposalPool.UnregisteredSpoke.selector, _chainId, _spokeAddress));
    vm.prank(_caller);
    hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, _description, queryResponse, signatures);
  }

  function testFuzz_RevertIf_QuerySpokeDoesNotMatchRegisteredSpoke(
    uint128 _voteWeight,
    uint16 _chainId,
    address _registeredSpokeAddress,
    address _queriedSpokeAddress,
    address _caller,
    string memory _description
  ) public {
    vm.assume(_registeredSpokeAddress != address(0));
    vm.assume(_queriedSpokeAddress != address(0));
    vm.assume(_registeredSpokeAddress != _queriedSpokeAddress);
    vm.assume(_caller != address(0));

    vm.prank(hubProposalPool.owner());
    hubProposalPool.registerSpoke(_chainId, _registeredSpokeAddress);

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] =
      VoteWeight({voteWeight: uint256(_voteWeight), chainId: _chainId, spokeAddress: _queriedSpokeAddress});

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(abi.encodeWithSelector(HubProposalPool.UnregisteredSpoke.selector, _chainId, _queriedSpokeAddress));

    vm.prank(_caller);
    hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, _description, queryResponse, signatures);
  }

  function testFuzz_RevertIf_TooManyEthCallResults(
    uint16 _chainId,
    address _tokenAddress,
    address _caller,
    uint128 _voteWeight,
    string memory _description
  ) public {
    vm.assume(_tokenAddress != address(0));
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    vm.prank(hubProposalPool.owner());
    hubProposalPool.registerSpoke(_chainId, _tokenAddress);

    bytes memory _resp = _mockQueryResponseWithMultipleResults(_chainId, _tokenAddress, _caller, _voteWeight);

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(abi.encodeWithSelector(HubProposalPool.TooManyEthCallResults.selector, 2));
    vm.prank(_caller);
    hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, _description, _resp, signatures);
  }
}

contract RegisterSpoke is HubProposalPoolTest {
  function testFuzz_CorrectlyRegisterSpoke(uint16 _chainId, address _spokeAddress, address _caller) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    vm.prank(hubProposalPool.owner());
    hubProposalPool.registerSpoke(_chainId, _spokeAddress);

    assertEq(hubProposalPool.registeredSpokes(_chainId), _spokeAddress);
  }

  function testFuzz_EmitsSpokeRegistered(uint16 _chainId, address _spokeAddress) public {
    vm.assume(_spokeAddress != address(0));

    vm.prank(hubProposalPool.owner());
    vm.expectEmit();
    emit HubProposalPool.SpokeRegistered(_chainId, _spokeAddress);
    hubProposalPool.registerSpoke(_chainId, _spokeAddress);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint16 _chainId, address _spokeAddress, address _caller) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubProposalPool.registerSpoke(_chainId, _spokeAddress);
  }

  function testFuzz_RevertIf_SpokeAddressIsZeroAddress(uint16 _chainId, address _caller) public {
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(hubProposalPool.owner()));

    vm.prank(hubProposalPool.owner());
    vm.expectRevert(abi.encodeWithSelector(HubProposalPool.ZeroTokenAddress.selector));
    hubProposalPool.registerSpoke(_chainId, address(0));
  }
}

contract _ExtractAccountFromCalldata is HubProposalPoolTest {
  function testFuzz_CorrectlyExtractsAccountFromCalldata(address _account) public view {
    // Simulate the calldata for a getVotes(address) function call
    bytes4 selector = bytes4(keccak256("getVotes(address)"));
    bytes memory callData = abi.encodeWithSelector(selector, _account);

    address extractedAccount = hubProposalPool.exposed_extractAccountFromCalldata(callData);
    assertEq(extractedAccount, _account, "Extracted account should match the input account");
  }

  function testFuzz_RevertIf_InvalidCallDataLength(bytes memory _callData) public {
    vm.assume(_callData.length < 24);
    vm.expectRevert(HubProposalPool.InvalidCallDataLength.selector);
    hubProposalPool.exposed_extractAccountFromCalldata(_callData);
  }
}
