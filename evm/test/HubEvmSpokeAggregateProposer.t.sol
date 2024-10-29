// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {EmptyWormholeAddress, InvalidContractAddress, InvalidChainId} from "wormhole-sdk/QueryResponse.sol";
import {HubEvmSpokeAggregateProposer} from "src/HubEvmSpokeAggregateProposer.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubEvmSpokeAggregateProposerHarness} from "test/harnesses/HubEvmSpokeAggregateProposerHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";

contract HubEvmSpokeAggregateProposerTest is WormholeEthQueryTest, AddressUtils, ProposalTest {
  HubEvmSpokeAggregateProposerHarness public crossChainAggregateProposer;
  HubGovernorHarness public hubGovernor;
  HubVotePool public hubVotePool;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubProposalExtender public extender;

  uint48 public constant INITIAL_MAX_QUERY_TIMESTAMP_OFFSET = 1 hours;

  uint48 public constant INITIAL_VOTING_DELAY = 1 days;
  uint32 public constant INITIAL_VOTING_PERIOD = 1 days;
  uint208 public constant INITIAL_QUORUM = 100e18;
  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;
  uint48 public constant VOTE_WEIGHT_WINDOW = 1 days;
  uint8 public constant NUM_WEIGHTS_TO_USE = 3;

  uint48 VOTE_TIME_EXTENSION = 1 days;
  uint48 MINIMUM_VOTE_EXTENSION = 1 hours;

  struct VoteWeight {
    uint256 voteWeight;
    uint16 chainId;
    address spokeAddress;
  }

  function setUp() public {
    _setupWormhole();

    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();

    hubVotePool = new HubVotePool(address(wormhole), initialOwner, address(timelock));

    extender = new HubProposalExtender(
      initialOwner, VOTE_TIME_EXTENSION, address(timelock), address(timelock), MINIMUM_VOTE_EXTENSION
    );

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: "Example Gov",
      token: token,
      timelock: timelock,
      initialVotingDelay: INITIAL_VOTING_DELAY,
      initialVotingPeriod: INITIAL_VOTING_PERIOD,
      initialProposalThreshold: PROPOSAL_THRESHOLD,
      initialQuorum: INITIAL_QUORUM,
      hubVotePool: address(timelock),
      wormholeCore: address(wormhole),
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: VOTE_WEIGHT_WINDOW
    });

    hubGovernor = new HubGovernorHarness(params);

    crossChainAggregateProposer = new HubEvmSpokeAggregateProposerHarness(
      address(wormhole), address(hubGovernor), INITIAL_MAX_QUERY_TIMESTAMP_OFFSET
    );
    hubGovernor.exposed_setWhitelistedProposer(address(crossChainAggregateProposer));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(hubGovernor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(hubGovernor));
  }

  // Mocks a query response using the provided voteWeights
  // The voteWeights are representative of responses from calls to the SpokeVoteAggregator.getVotes() function
  function _mockQueryResponse(VoteWeight[] memory _voteWeights, address _proposer) internal view returns (bytes memory) {
    bytes memory queryRequestBytes = "";
    bytes memory perChainResponses = "";
    uint64 targetTime = uint64(vm.getBlockTimestamp());
    uint64 targetTimeMicroseconds = targetTime * 1_000_000;

    for (uint256 i = 0; i < _voteWeights.length; i++) {
      (bytes memory newQueryRequestBytes, bytes memory newPerChainResponses) =
        _buildQueryRequestAndPerChainResponse(_voteWeights[i], _proposer, targetTimeMicroseconds, targetTime);
      queryRequestBytes = abi.encodePacked(queryRequestBytes, newQueryRequestBytes);
      perChainResponses = abi.encodePacked(perChainResponses, newPerChainResponses);
    }
    return _buildQueryResponse(_voteWeights, queryRequestBytes, perChainResponses);
  }

  function _mockQueryResponse(VoteWeight[] memory _voteWeights, address _proposer, uint64 _calldataTimepoint)
    internal
    view
    returns (bytes memory)
  {
    bytes memory queryRequestBytes = "";
    bytes memory perChainResponses = "";
    uint64 targetTime = uint64(vm.getBlockTimestamp());
    uint64 targetTimeMicroseconds = targetTime * 1_000_000;

    for (uint256 i = 0; i < _voteWeights.length; i++) {
      (bytes memory newQueryRequestBytes, bytes memory newPerChainResponses) =
        _buildQueryRequestAndPerChainResponse(_voteWeights[i], _proposer, targetTimeMicroseconds, _calldataTimepoint);
      queryRequestBytes = abi.encodePacked(queryRequestBytes, newQueryRequestBytes);
      perChainResponses = abi.encodePacked(perChainResponses, newPerChainResponses);
    }
    return _buildQueryResponse(_voteWeights, queryRequestBytes, perChainResponses);
  }

  function _buildQueryRequestAndPerChainResponse(
    VoteWeight memory _voteWeight,
    address _proposer,
    uint64 _targetBlockTime,
    uint64 _timepoint
  ) internal view returns (bytes memory queryRequestBytes, bytes memory perChainResponses) {
    uint256 voteWeight = _voteWeight.voteWeight;
    uint16 chainId = _voteWeight.chainId;
    address spokeAddress = _voteWeight.spokeAddress;

    bytes memory ethCall = QueryTest.buildEthCallByTimestampRequestBytes(
      _targetBlockTime,
      bytes(""), /* targetBlockHint */
      bytes(""), /* followingBlockHint */
      1,
      QueryTest.buildEthCallDataBytes(
        spokeAddress, abi.encodeWithSignature("getVotes(address,uint256)", _proposer, _timepoint)
      )
    );

    queryRequestBytes =
      QueryTest.buildPerChainRequestBytes(chainId, crossChainAggregateProposer.QT_ETH_CALL_BY_TIMESTAMP(), ethCall);

    bytes memory ethCallResp = _buildResponseBytesWithLatestTimestamp(_targetBlockTime, uint128(voteWeight));

    perChainResponses =
      QueryTest.buildPerChainResponseBytes(chainId, crossChainAggregateProposer.QT_ETH_CALL_BY_TIMESTAMP(), ethCallResp);
  }

  function _buildResponseBytesWithLatestTimestamp(uint64 targetBlockTime, uint256 voteWeight)
    internal
    view
    returns (bytes memory)
  {
    uint64 targetBlockNumber = uint64(vm.getBlockNumber());
    uint64 followingBlockNumber = targetBlockNumber + 1;
    uint64 followingBlockTime = targetBlockTime + 1_000_000; // Add 1 second in microseconds

    return QueryTest.buildEthCallByTimestampResponseBytes(
      targetBlockNumber,
      blockhash(targetBlockNumber),
      targetBlockTime,
      followingBlockNumber,
      blockhash(followingBlockNumber),
      followingBlockTime,
      1,
      QueryTest.buildEthCallResultBytes(abi.encode(voteWeight))
    );
  }

  function _buildQueryResponse(
    VoteWeight[] memory _voteWeights,
    bytes memory _queryRequestBytes,
    bytes memory _perChainResponses
  ) internal pure returns (bytes memory) {
    return QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      QueryTest.buildOffChainQueryRequestBytes(VERSION, 0, uint8(_voteWeights.length), _queryRequestBytes),
      uint8(_voteWeights.length),
      _perChainResponses
    );
  }

  function _mockQueryResponseWithMultipleResults(
    uint16 _chainId,
    address _tokenAddress,
    address _caller,
    uint128 _voteWeight
  ) internal view returns (bytes memory) {
    uint64 targetBlockTime = uint64(vm.getBlockTimestamp());
    uint64 targetTimeMicroseconds = targetBlockTime * 1_000_000;

    bytes memory ethCall = QueryTest.buildEthCallByTimestampRequestBytes(
      targetTimeMicroseconds,
      bytes(""),
      bytes(""),
      2, // numCallData
      abi.encodePacked(
        QueryTest.buildEthCallDataBytes(
          _tokenAddress, abi.encodeWithSignature("getVotes(address,uint256)", _caller, targetTimeMicroseconds)
        ),
        QueryTest.buildEthCallDataBytes(
          _tokenAddress, abi.encodeWithSignature("getVotes(address,uint256)", _caller, targetTimeMicroseconds)
        )
      )
    );

    bytes memory queryRequestBytes =
      QueryTest.buildPerChainRequestBytes(_chainId, crossChainAggregateProposer.QT_ETH_CALL_BY_TIMESTAMP(), ethCall);

    bytes memory ethCallResp = _buildInvalidEthCallRespMultiResults(_voteWeight, targetTimeMicroseconds);

    bytes memory perChainResponses = QueryTest.buildPerChainResponseBytes(
      _chainId, crossChainAggregateProposer.QT_ETH_CALL_BY_TIMESTAMP(), ethCallResp
    );

    VoteWeight[] memory _voteWeights = new VoteWeight[](1);
    _voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _tokenAddress});

    return _buildQueryResponse(_voteWeights, queryRequestBytes, perChainResponses);
  }

  function _buildInvalidEthCallRespMultiResults(uint128 _voteWeight, uint64 targetBlockTime)
    internal
    view
    returns (bytes memory ethCallResp)
  {
    uint64 targetBlockNumber = uint64(vm.getBlockNumber());
    uint64 followingBlockNumber = targetBlockNumber + 1;
    uint64 followingBlockTime = targetBlockTime + 1;

    bytes memory invalidEthCallResp = abi.encodePacked(
      QueryTest.buildEthCallResultBytes(abi.encode(_voteWeight)),
      QueryTest.buildEthCallResultBytes(abi.encode(_voteWeight))
    );

    ethCallResp = QueryTest.buildEthCallByTimestampResponseBytes(
      targetBlockNumber,
      blockhash(targetBlockNumber),
      targetBlockTime,
      followingBlockNumber,
      blockhash(followingBlockNumber),
      followingBlockTime,
      2, // numResults
      invalidEthCallResp
    );
  }

  function _mockQueryResponseWithCustomTimestamps(
    VoteWeight[] memory _voteWeights,
    address _caller,
    uint64[] memory _timestamps
  ) internal view returns (bytes memory) {
    bytes memory queryRequestBytes = "";
    bytes memory perChainResponses = "";

    for (uint256 i = 0; i < _voteWeights.length; i++) {
      uint64 targetTime = _timestamps[i];
      uint64 targetTimeMicroseconds = targetTime * 1_000_000;
      (bytes memory newQueryRequestBytes, bytes memory newPerChainResponses) =
        _buildQueryRequestAndPerChainResponse(_voteWeights[i], _caller, targetTimeMicroseconds, targetTime);
      queryRequestBytes = abi.encodePacked(queryRequestBytes, newQueryRequestBytes);
      perChainResponses = abi.encodePacked(perChainResponses, newPerChainResponses);
    }

    return _buildQueryResponse(_voteWeights, queryRequestBytes, perChainResponses);
  }

  function _getSignatures(bytes memory _response) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_response, address(crossChainAggregateProposer));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }

  function _createProposal(bytes memory _callData) internal returns (ProposalBuilder) {
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(hubGovernor), 0, _callData);
    return builder;
  }

  function _createArbitraryProposal() internal returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", 100));
  }

  function _checkThresholdMet(VoteWeight[] memory _voteWeights, uint256 _hubVoteWeight, uint256 _threshold)
    internal
    pure
    returns (bool)
  {
    if (_hubVoteWeight >= _threshold) return true;

    uint256 remainingThreshold = _threshold - _hubVoteWeight;
    uint256 accumulator = 0;

    for (uint256 i = 0; i < _voteWeights.length; i++) {
      accumulator += _voteWeights[i].voteWeight;
      if (accumulator >= remainingThreshold) return true;
    }

    return false;
  }

  function _assumeThresholdMet(VoteWeight[] memory _voteWeights) internal view {
    bool thresholdMet = _checkThresholdMet(_voteWeights, 0, hubGovernor.proposalThreshold());
    vm.assume(thresholdMet);
  }

  function _warpToValidTimestamp() internal {
    uint48 windowLength = hubGovernor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    vm.warp(vm.getBlockTimestamp() + windowLength);
  }

  function _registerSpokes(VoteWeight[] memory _voteWeights) internal {
    vm.startPrank(crossChainAggregateProposer.owner());
    for (uint256 i = 0; i < _voteWeights.length; i++) {
      crossChainAggregateProposer.registerSpoke(_voteWeights[i].chainId, _voteWeights[i].spokeAddress);
    }
    vm.stopPrank();
  }

  function _checkAndProposeIfEligible(
    VoteWeight[] memory _voteWeights,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    string memory _description,
    address _caller
  ) internal returns (uint256 proposalId) {
    bytes memory queryResponse = _mockQueryResponse(_voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    vm.prank(_caller);
    proposalId = crossChainAggregateProposer.checkAndProposeIfEligible(
      _targets, _values, _calldatas, _description, queryResponse, signatures
    );
  }
}

contract Constructor is Test {
  function testFuzz_CorrectlySetConstructorArgs(
    address _core,
    address _hubGovernor,
    uint48 _initialMaxQueryTimestampOffset
  ) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));

    HubEvmSpokeAggregateProposer crossChainAggregateProposer =
      new HubEvmSpokeAggregateProposer(_core, _hubGovernor, _initialMaxQueryTimestampOffset);
    assertEq(address(crossChainAggregateProposer.HUB_GOVERNOR()), _hubGovernor);
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(address _hubGovernor, uint48 _initialMaxQueryTimestampOffset) public {
    vm.expectRevert(EmptyWormholeAddress.selector);
    new HubEvmSpokeAggregateProposer(address(0), _hubGovernor, _initialMaxQueryTimestampOffset);
  }

  function testFuzz_RevertIf_HubGovernorIsZeroAddress(address _core, uint48 _initialMaxQueryTimestampOffset) public {
    vm.assume(_core != address(0));
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new HubEvmSpokeAggregateProposer(_core, address(0), _initialMaxQueryTimestampOffset);
  }
}

contract Cancel is HubEvmSpokeAggregateProposerTest {
  function testFuzz_CreatorSuccesfullyCancelsAProposal(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    _warpToValidTimestamp();
    _assumeThresholdMet(voteWeights);
    _registerSpokes(voteWeights);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    uint256 canceled = _checkAndProposeIfEligible(voteWeights, targets, values, calldatas, _description, _caller);
    vm.prank(_caller);
    crossChainAggregateProposer.cancel(targets, values, calldatas, keccak256(bytes(_description)));

    assertEq(
      uint8(hubGovernor.state(canceled)), uint8(IGovernor.ProposalState.Canceled), "Proposal has not been canceled"
    );
  }

  function testFuzz_RevertIf_CallerIsNotProposalCreator(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller,
    address _canceler
  ) public {
    vm.assume(_spokeAddress != address(0) && _caller != _canceler);
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
    vm.assume(_caller != _canceler);

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    _warpToValidTimestamp();
    _assumeThresholdMet(voteWeights);
    _registerSpokes(voteWeights);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    _checkAndProposeIfEligible(voteWeights, targets, values, calldatas, _description, _caller);
    vm.expectRevert(abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidCaller.selector, _canceler, _caller));
    vm.prank(_canceler);
    crossChainAggregateProposer.cancel(targets, values, calldatas, keccak256(bytes(_description)));
  }
}

contract CheckAndProposeIfEligible is HubEvmSpokeAggregateProposerTest {
  function _checkAndProposeIfEligibleCustomTimepoints(
    VoteWeight[] memory _voteWeights,
    address[] memory _targets,
    uint256[] memory _values,
    bytes[] memory _calldatas,
    address _caller,
    uint64[] memory _timestamps
  ) public returns (uint256) {
    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(_voteWeights, _caller, _timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    vm.prank(_caller);
    uint256 proposalId = crossChainAggregateProposer.checkAndProposeIfEligible(
      _targets, _values, _calldatas, "Test Proposal", queryResponse, signatures
    );

    return proposalId;
  }

  function _buildUniformTimestampArray(uint8 arrayLength) internal view returns (uint64[] memory) {
    uint64 timestamp = uint64(vm.getBlockTimestamp());
    uint64[] memory timestamps = new uint64[](arrayLength);
    timestamps[0] = timestamp;
    timestamps[1] = timestamp;
    timestamps[2] = timestamp;

    return timestamps;
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligibleSingleVoteWeight(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    _warpToValidTimestamp();
    _assumeThresholdMet(voteWeights);
    _registerSpokes(voteWeights);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    uint256 proposalId = _checkAndProposeIfEligible(voteWeights, targets, values, calldatas, _description, _caller);

    assertEq(
      hubGovernor.hashProposal(targets, values, calldatas, keccak256(bytes(_description))),
      proposalId,
      "Proposal ID should match the hash of the proposal"
    );
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligibleTwoVoteWeights(
    uint128 _voteWeight1,
    uint128 _voteWeight2,
    uint16 _chainId1,
    uint16 _chainId2,
    address _spokeAddress1,
    address _spokeAddress2,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_spokeAddress1 != address(0) && _spokeAddress2 != address(0));
    vm.assume(_chainId1 != _chainId2);
    vm.assume(_spokeAddress1 != _spokeAddress2);
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));

    VoteWeight[] memory voteWeights = new VoteWeight[](2);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight1, chainId: _chainId1, spokeAddress: _spokeAddress1});
    voteWeights[1] = VoteWeight({voteWeight: _voteWeight2, chainId: _chainId2, spokeAddress: _spokeAddress2});

    _warpToValidTimestamp();
    _assumeThresholdMet(voteWeights);

    _registerSpokes(voteWeights);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    uint256 proposalId = _checkAndProposeIfEligible(voteWeights, targets, values, calldatas, _description, _caller);

    assertEq(
      hubGovernor.hashProposal(targets, values, calldatas, keccak256(bytes(_description))),
      proposalId,
      "Proposal ID should match the hash of the proposal"
    );
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligibleWithAtLeastTwoTokenCheckpoints(
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller,
    uint48 _amount2
  ) public {
    vm.assume(_spokeAddress != address(0) && _spokeAddress != address(0));
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
    uint256 _amount1 = hubGovernor.proposalThreshold();

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: 0, chainId: _chainId, spokeAddress: _spokeAddress});

    vm.startPrank(_caller);
    token.delegate(_caller);
    token.mint(_caller, _amount1);
    vm.stopPrank();

    _warpToValidTimestamp();

    vm.startPrank(_caller);
    token.mint(_caller, uint256(_amount2));
    vm.stopPrank();

    _registerSpokes(voteWeights);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    uint256 proposalId = _checkAndProposeIfEligible(voteWeights, targets, values, calldatas, _description, _caller);

    assertEq(
      hubGovernor.hashProposal(targets, values, calldatas, keccak256(bytes(_description))),
      proposalId,
      "Proposal ID should match the hash of the proposal"
    );
    assertEq(hubGovernor.getVotes(address(_caller), vm.getBlockTimestamp()), _amount1);
  }

  function testFuzz_CorrectlyCheckAndProposeIfEligibleThreeVoteWeights(
    uint128 _voteWeight1,
    uint128 _voteWeight2,
    uint128 _voteWeight3,
    uint16 _chainId1,
    uint16 _chainId2,
    uint16 _chainId3,
    address _spokeAddress1,
    address _spokeAddress2,
    address _spokeAddress3,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_spokeAddress1 != address(0) && _spokeAddress2 != address(0) && _spokeAddress3 != address(0));
    vm.assume(_chainId1 != _chainId2 && _chainId1 != _chainId3 && _chainId2 != _chainId3);
    vm.assume(_spokeAddress1 != _spokeAddress2 && _spokeAddress1 != _spokeAddress3 && _spokeAddress2 != _spokeAddress3);
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));

    VoteWeight[] memory voteWeights = new VoteWeight[](3);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight1, chainId: _chainId1, spokeAddress: _spokeAddress1});
    voteWeights[1] = VoteWeight({voteWeight: _voteWeight2, chainId: _chainId2, spokeAddress: _spokeAddress2});
    voteWeights[2] = VoteWeight({voteWeight: _voteWeight3, chainId: _chainId3, spokeAddress: _spokeAddress3});

    _warpToValidTimestamp();
    _assumeThresholdMet(voteWeights);

    _registerSpokes(voteWeights);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    uint256 proposalId = _checkAndProposeIfEligible(voteWeights, targets, values, calldatas, _description, _caller);

    assertEq(
      hubGovernor.hashProposal(targets, values, calldatas, keccak256(bytes(_description))),
      proposalId,
      "Proposal ID should match the hash of the proposal"
    );
  }

  function testFuzz_CheckAndProposeIfEligibleWithValidTimestamps(
    address _caller,
    uint128 _voteWeight1,
    uint128 _voteWeight2,
    uint128 _voteWeight3
  ) public {
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
    _warpToValidTimestamp();

    VoteWeight[] memory voteWeights = new VoteWeight[](3);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight1, chainId: 1, spokeAddress: makeAddr("SpokeAddress1")});
    voteWeights[1] = VoteWeight({voteWeight: _voteWeight2, chainId: 2, spokeAddress: makeAddr("SpokeAddress2")});
    voteWeights[2] = VoteWeight({voteWeight: _voteWeight3, chainId: 3, spokeAddress: makeAddr("SpokeAddress3")});

    uint64[] memory timestamps = _buildUniformTimestampArray(3);

    _assumeThresholdMet(voteWeights);

    _registerSpokes(voteWeights);
    ProposalBuilder builder = _createArbitraryProposal();

    address[] memory _targets = builder.targets();
    uint256[] memory _values = builder.values();
    bytes[] memory _calldatas = builder.calldatas();

    uint256 proposalId =
      _checkAndProposeIfEligibleCustomTimepoints(voteWeights, _targets, _values, _calldatas, _caller, timestamps);

    assertEq(hubGovernor.hashProposal(_targets, _values, _calldatas, keccak256(bytes("Test Proposal"))), proposalId);
  }

  function testFuzz_RevertIf_QueryDoesNotHaveEnoughWeightAndCheckpointMinimumIsTooLow(
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller,
    uint48 _amount1
  ) public {
    vm.assume(_spokeAddress != address(0) && _spokeAddress != address(0));
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
    uint256 _amount2 = hubGovernor.proposalThreshold();

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: 0, chainId: _chainId, spokeAddress: _spokeAddress});

    vm.startPrank(_caller);
    token.delegate(_caller);
    token.mint(_caller, uint256(_amount1));
    vm.stopPrank();

    _warpToValidTimestamp();

    vm.startPrank(_caller);
    token.mint(_caller, _amount2);
    vm.stopPrank();

    _registerSpokes(voteWeights);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    vm.prank(_caller);
    vm.expectRevert(HubEvmSpokeAggregateProposer.InsufficientVoteWeight.selector);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_InsufficientVoteWeight(string memory _description, address _caller) public {
    vm.assume(_caller != address(0));
    vm.assume(_caller != address(crossChainAggregateProposer.owner()));

    // Create a vote weight with a below threshold total
    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold() - 1, chainId: 1, spokeAddress: address(token)});

    _registerSpokes(voteWeights);
    _warpToValidTimestamp();

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(HubEvmSpokeAggregateProposer.InsufficientVoteWeight.selector);
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_QueryContainsMultipleResponsesFromTheSameChain(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));

    VoteWeight[] memory voteWeights = new VoteWeight[](2);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});
    voteWeights[1] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    _warpToValidTimestamp();
    _assumeThresholdMet(voteWeights);

    _registerSpokes(voteWeights);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();
    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    vm.expectRevert(InvalidChainId.selector);
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_InvalidCaller(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    address _expectedAccount,
    address _caller,
    string memory _description
  ) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_expectedAccount != address(0) && _caller != address(0));
    vm.assume(_caller != _expectedAccount && _caller != address(crossChainAggregateProposer.owner()));

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    _warpToValidTimestamp();
    _registerSpokes(voteWeights);

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _expectedAccount);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(
      abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidCaller.selector, _caller, _expectedAccount)
    );
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_InvalidTimepoint(
    uint128 _voteWeight,
    uint16 _chainId,
    address _spokeAddress,
    address _caller,
    uint64 _calldataTimepoint,
    string memory _description
  ) public {
    _warpToValidTimestamp();
    vm.assume(_spokeAddress != address(0));
    vm.assume(_calldataTimepoint != uint64(vm.getBlockTimestamp()));


    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight, chainId: _chainId, spokeAddress: _spokeAddress});

    _assumeThresholdMet(voteWeights);
    _registerSpokes(voteWeights);

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller, _calldataTimepoint);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(
      abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidTimestamp.selector, vm.getBlockTimestamp() * 1_000_000)
    );
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
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

    _warpToValidTimestamp();

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] = VoteWeight({voteWeight: uint256(_voteWeight), chainId: _chainId, spokeAddress: _spokeAddress});

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(InvalidContractAddress.selector);
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
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

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] =
      VoteWeight({voteWeight: uint256(_voteWeight), chainId: _chainId, spokeAddress: _queriedSpokeAddress});

    _warpToValidTimestamp();
    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.registerSpoke(_chainId, _registeredSpokeAddress);

    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);
    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(InvalidContractAddress.selector);

    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, _description, queryResponse, signatures
    );
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
    vm.assume(_caller != address(crossChainAggregateProposer.owner()));

    _warpToValidTimestamp();

    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.registerSpoke(_chainId, _tokenAddress);

    bytes memory _resp = _mockQueryResponseWithMultipleResults(_chainId, _tokenAddress, _caller, _voteWeight);

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(abi.encodeWithSelector(HubEvmSpokeAggregateProposer.TooManyEthCallResults.selector, 2));
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(targets, values, calldatas, _description, _resp, signatures);
  }

  function testFuzz_RevertIf_QueriesHaveDifferentTimestamps(address _caller, uint128 _voteWeight1, uint128 _voteWeight2)
    public
  {
    _warpToValidTimestamp();

    uint64 timestamp = uint64(vm.getBlockTimestamp());
    uint64[] memory timestamps = new uint64[](2);
    timestamps[0] = timestamp;
    timestamps[1] = timestamp + 1; // Different timestamp

    VoteWeight[] memory voteWeights = new VoteWeight[](2);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight1, chainId: 1, spokeAddress: makeAddr("SpokeAddress1")});
    voteWeights[1] = VoteWeight({voteWeight: _voteWeight2, chainId: 2, spokeAddress: makeAddr("SpokeAddress2")});

    _registerSpokes(voteWeights);

    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, _caller, timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.expectRevert(
      abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidTimestamp.selector, timestamps[1] * 1_000_000)
    );
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, "Test Proposal", queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_LessThanMaxQueryTimestampOffset(address _caller) public {
    _warpToValidTimestamp();

    uint64[] memory timestamps = new uint64[](1);
    timestamps[0] = uint64(vm.getBlockTimestamp()) - crossChainAggregateProposer.maxQueryTimestampOffset() - 1;

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 1, spokeAddress: makeAddr("SpokeAddress")});
    _registerSpokes(voteWeights);

    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, address(hubGovernor), timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(_caller);
    vm.expectRevert(
      abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidTimestamp.selector, timestamps[0] * 1_000_000)
    );
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, "Test Proposal", queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_QueryTimestampGreaterThanCurrentTimestamp(address _caller) public {
    _warpToValidTimestamp();

    uint64[] memory timestamps = new uint64[](1);
    timestamps[0] = uint64(vm.getBlockTimestamp()) + 1;

    VoteWeight[] memory voteWeights = new VoteWeight[](1);
    voteWeights[0] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 1, spokeAddress: makeAddr("SpokeAddress")});
    _registerSpokes(voteWeights);

    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, _caller, timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(_caller);
    vm.expectRevert(
      abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidTimestamp.selector, timestamps[0] * 1_000_000)
    );
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, "Test Proposal", queryResponse, signatures
    );
  }

  function testFuzz_RevertIf_QueryTimestampsNotSynchronized(address _caller) public {
    _warpToValidTimestamp();

    uint64[] memory timestamps = new uint64[](5);
    timestamps[0] = uint64(vm.getBlockTimestamp());
    timestamps[1] = uint64(vm.getBlockTimestamp());
    timestamps[2] = uint64(vm.getBlockTimestamp());
    timestamps[3] = uint64(vm.getBlockTimestamp() - 1);

    VoteWeight[] memory voteWeights = new VoteWeight[](5);
    voteWeights[0] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 1, spokeAddress: makeAddr("SpokeAddress1")});
    voteWeights[1] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 2, spokeAddress: makeAddr("SpokeAddress2")});
    voteWeights[2] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 3, spokeAddress: makeAddr("SpokeAddress3")});
    voteWeights[3] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 4, spokeAddress: makeAddr("SpokeAddress4")});
    voteWeights[4] =
      VoteWeight({voteWeight: hubGovernor.proposalThreshold(), chainId: 5, spokeAddress: makeAddr("SpokeAddress5")});

    _registerSpokes(voteWeights);

    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, _caller, timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(_caller);
    vm.expectRevert(
      abi.encodeWithSelector(HubEvmSpokeAggregateProposer.InvalidTimestamp.selector, timestamps[3] * 1_000_000)
    );
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, "Test Proposal", queryResponse, signatures
    );
  }
}

contract RegisterSpoke is HubEvmSpokeAggregateProposerTest {
  function testFuzz_CorrectlyRegisterSpoke(uint16 _chainId, address _spokeAddress) public {
    vm.assume(_spokeAddress != address(0));

    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.registerSpoke(_chainId, _spokeAddress);

    assertEq(crossChainAggregateProposer.registeredSpokes(_chainId), _spokeAddress);
  }

  function testFuzz_EmitsSpokeRegistered(uint16 _chainId, address _spokeAddress) public {
    vm.assume(_spokeAddress != address(0));

    address existingAddress = crossChainAggregateProposer.registeredSpokes(_chainId);
    vm.prank(crossChainAggregateProposer.owner());
    vm.expectEmit();
    emit HubEvmSpokeAggregateProposer.SpokeRegistered(_chainId, existingAddress, _spokeAddress);
    crossChainAggregateProposer.registerSpoke(_chainId, _spokeAddress);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint16 _chainId, address _spokeAddress, address _caller) public {
    vm.assume(_spokeAddress != address(0));
    vm.assume(_caller != address(crossChainAggregateProposer.owner()));

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    crossChainAggregateProposer.registerSpoke(_chainId, _spokeAddress);
  }
}

contract SetMaxQueryTimestampOffset is HubEvmSpokeAggregateProposerTest {
  function testFuzz_CorrectlySetMaxQueryTimestampOffset(uint48 _maxQueryTimestampOffset) public {
    vm.assume(_maxQueryTimestampOffset != 0);
    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.setMaxQueryTimestampOffset(_maxQueryTimestampOffset);
    assertEq(crossChainAggregateProposer.maxQueryTimestampOffset(), _maxQueryTimestampOffset);
  }

  function testFuzz_EmitsMaxQueryTimestampOffsetUpdatedEvent(uint48 _maxQueryTimestampOffset) public {
    vm.assume(_maxQueryTimestampOffset != 0);
    vm.expectEmit();
    emit HubEvmSpokeAggregateProposer.MaxQueryTimestampOffsetUpdated(
      crossChainAggregateProposer.maxQueryTimestampOffset(), _maxQueryTimestampOffset
    );
    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.setMaxQueryTimestampOffset(_maxQueryTimestampOffset);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint48 _maxQueryTimestampOffset, address _caller) public {
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
    vm.assume(_maxQueryTimestampOffset != 0);
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    crossChainAggregateProposer.setMaxQueryTimestampOffset(_maxQueryTimestampOffset);
  }

  function test_RevertIf_ZeroTimeDelta() public {
    vm.prank(crossChainAggregateProposer.owner());
    vm.expectRevert(HubEvmSpokeAggregateProposer.InvalidOffset.selector);
    crossChainAggregateProposer.setMaxQueryTimestampOffset(0);
  }
}

contract _ExtractAccountFromCalldata is HubEvmSpokeAggregateProposerTest {
  function testFuzz_CorrectlyExtractsAccountFromCalldata(address _account, uint256 _timepoint) public view {
    // Simulate the calldata for a getVotes(address) function call
    bytes4 selector = bytes4(keccak256("getVotes(address,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _account, _timepoint);

    (address extractedAccount, uint256 extractedTimepoint) =
      crossChainAggregateProposer.exposed_extractAccountFromCalldata(callData);
    assertEq(extractedAccount, _account, "Extracted account should match the input account");
    assertEq(extractedTimepoint, _timepoint, "Extracted timepoint should match the input timepoint");
  }

  function testFuzz_RevertIf_InvalidCallDataLength(bytes memory _callData) public {
    vm.assume(_callData.length != 68);
    vm.expectRevert(abi.encodeWithSelector(BytesParsing.LengthMismatch.selector, _callData.length, 68));
    crossChainAggregateProposer.exposed_extractAccountFromCalldata(_callData);
  }
}
