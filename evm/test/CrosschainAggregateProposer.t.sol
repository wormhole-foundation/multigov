// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {EmptyWormholeAddress} from "wormhole/query/QueryResponse.sol";

import {CrossChainAggregateProposer} from "src/CrossChainAggregateProposer.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubGovernorProposalExtender} from "src/HubGovernorProposalExtender.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {CrossChainAggregateProposerHarness} from "test/harnesses/CrossChainAggregateProposerHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";

contract CrossChainAggregateProposerTest is WormholeEthQueryTest, AddressUtils, ProposalTest {
  CrossChainAggregateProposerHarness public crossChainAggregateProposer;
  HubGovernorHarness public hubGovernor;
  HubVotePool public hubVotePool;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubGovernorProposalExtender public extender;

  uint48 public constant INITIAL_MAX_QUERY_TIMESTAMP_OFFSET = 1 hours;

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
      governorProposalExtender: address(extender),
      initialVoteWindow: VOTE_WINDOW
    });

    hubGovernor = new HubGovernorHarness(params);

    crossChainAggregateProposer = new CrossChainAggregateProposerHarness(
      address(wormhole), address(hubGovernor), INITIAL_MAX_QUERY_TIMESTAMP_OFFSET
    );
    hubGovernor.exposed_setWhitelistedProposer(address(crossChainAggregateProposer));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("PROPOSER_ROLE"), address(hubGovernor));

    vm.prank(initialOwner);
    timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(hubGovernor));

    vm.prank(initialOwner);
    hubVotePool.transferOwnership(address(hubGovernor));
  }

  // Mocks a query response using the provided voteWeights
  // The voteWeights are representative of responses from calls to the SpokeVoteAggregator.getVotes() function
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
        QueryTest.buildEthCallDataBytes(
          spokeAddress, abi.encodeWithSignature("getVotes(address,uint256)", proposer, vm.getBlockTimestamp())
        )
      );

      queryRequestBytes = abi.encodePacked(
        queryRequestBytes,
        QueryTest.buildPerChainRequestBytes(chainId, crossChainAggregateProposer.QT_ETH_CALL(), ethCall)
      );

      bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
        uint64(block.number),
        blockhash(block.number),
        uint64(block.timestamp),
        1,
        QueryTest.buildEthCallResultBytes(abi.encode(voteWeight))
      );

      perChainResponses = abi.encodePacked(
        perChainResponses,
        QueryTest.buildPerChainResponseBytes(chainId, crossChainAggregateProposer.QT_ETH_CALL(), ethCallResp)
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
      abi.encodePacked(
        QueryTest.buildPerChainRequestBytes(_chainId, crossChainAggregateProposer.QT_ETH_CALL(), ethCall)
      )
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
      QueryTest.buildPerChainResponseBytes(_chainId, crossChainAggregateProposer.QT_ETH_CALL(), _ethCallResp)
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
      uint256 voteWeight = _voteWeights[i].voteWeight;
      uint16 chainId = _voteWeights[i].chainId;
      address spokeAddress = _voteWeights[i].spokeAddress;

      bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
        bytes("0x1296c33"),
        1,
        QueryTest.buildEthCallDataBytes(
          spokeAddress, abi.encodeWithSignature("getVotes(address,uint256)", _caller, vm.getBlockTimestamp())
        )
      );

      queryRequestBytes = abi.encodePacked(
        queryRequestBytes,
        QueryTest.buildPerChainRequestBytes(chainId, crossChainAggregateProposer.QT_ETH_CALL(), ethCall)
      );

      bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
        uint64(block.number),
        blockhash(block.number),
        _timestamps[i], // Use custom timestamp
        1,
        QueryTest.buildEthCallResultBytes(abi.encode(voteWeight))
      );

      perChainResponses = abi.encodePacked(
        perChainResponses,
        QueryTest.buildPerChainResponseBytes(chainId, crossChainAggregateProposer.QT_ETH_CALL(), ethCallResp)
      );
    }

    bytes memory response = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      QueryTest.buildOffChainQueryRequestBytes(VERSION, 0, uint8(_voteWeights.length), queryRequestBytes),
      uint8(_voteWeights.length),
      perChainResponses
    );

    return response;
  }

  function _getSignatures(bytes memory response) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(response, address(crossChainAggregateProposer));
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
  function testFuzz_CorrectlySetConstructorArgs(
    address _core,
    address _hubGovernor,
    uint48 _initialMaxQueryTimestampOffset
  ) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));

    CrossChainAggregateProposer crossChainAggregateProposer =
      new CrossChainAggregateProposer(_core, _hubGovernor, _initialMaxQueryTimestampOffset);
    assertEq(address(crossChainAggregateProposer.WORMHOLE_CORE()), _core);
    assertEq(address(crossChainAggregateProposer.HUB_GOVERNOR()), _hubGovernor);
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(address _hubGovernor, uint48 _initialMaxQueryTimestampOffset) public {
    vm.expectRevert(EmptyWormholeAddress.selector);
    new CrossChainAggregateProposer(address(0), _hubGovernor, _initialMaxQueryTimestampOffset);
  }

  function testFuzz_RevertIf_HubGovernorIsZeroAddress(address _core, uint48 _initialMaxQueryTimestampOffset) public {
    vm.assume(_core != address(0));
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new CrossChainAggregateProposer(_core, address(0), _initialMaxQueryTimestampOffset);
  }
}

contract CheckAndProposeIfEligible is CrossChainAggregateProposerTest {
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

  function _warpToValidTimestamp() internal {
    uint48 windowLength = hubGovernor.getVoteWeightWindowLength(uint96(vm.getBlockTimestamp()));
    vm.warp(vm.getBlockTimestamp() + windowLength);
  }

  function _registerSpokes(VoteWeight[] memory voteWeights) internal {
    vm.startPrank(crossChainAggregateProposer.owner());
    for (uint256 i = 0; i < voteWeights.length; i++) {
      crossChainAggregateProposer.registerSpoke(voteWeights[i].chainId, voteWeights[i].spokeAddress);
    }
    vm.stopPrank();
  }

  function _setupAndExecuteProposalIfEligible(
    VoteWeight[] memory voteWeights,
    string memory _description,
    address _caller
  ) internal returns (uint256 proposalId) {
    bytes memory queryResponse = _mockQueryResponse(voteWeights, _caller);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_caller);
    proposalId = crossChainAggregateProposer.checkAndProposeIfEligible(
      builder.targets(), builder.values(), builder.calldatas(), _description, queryResponse, signatures
    );
    vm.stopPrank();
  }

  function _setupAndExecuteProposalIfEligibleCustomTimepoints(
    VoteWeight[] memory voteWeights,
    string memory _description,
    address _caller,
    uint64[] memory _timestamps
  ) internal returns (uint256) {
    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, _caller, _timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_caller);
    uint256 proposalId = crossChainAggregateProposer.checkAndProposeIfEligible(
      builder.targets(), builder.values(), builder.calldatas(), _description, queryResponse, signatures
    );
    vm.stopPrank();

    return proposalId;
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
    bool thresholdMet = _checkThresholdMet(voteWeights, 0, hubGovernor.proposalThreshold());
    vm.assume(thresholdMet);

    _registerSpokes(voteWeights);
    uint256 proposalId = _setupAndExecuteProposalIfEligible(voteWeights, _description, _caller);

    assertTrue(proposalId > 0, "Proposal should be created");
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
    bool thresholdMet = _checkThresholdMet(voteWeights, 0, hubGovernor.proposalThreshold());
    vm.assume(thresholdMet);

    _registerSpokes(voteWeights);
    uint256 proposalId = _setupAndExecuteProposalIfEligible(voteWeights, _description, _caller);

    assertTrue(proposalId > 0, "Proposal should be created");
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
    bool thresholdMet = _checkThresholdMet(voteWeights, 0, hubGovernor.proposalThreshold());
    vm.assume(thresholdMet);

    _registerSpokes(voteWeights);
    uint256 proposalId = _setupAndExecuteProposalIfEligible(voteWeights, _description, _caller);

    assertTrue(proposalId > 0, "Proposal should be created");
  }

  function testFuzz_CheckAndProposeIfEligibleWithValidTimestamps(
    address _caller,
    uint128 _voteWeight1,
    uint128 _voteWeight2,
    uint128 _voteWeight3,
    address _spokeAddress1,
    address _spokeAddress2,
    address _spokeAddress3
  ) public {
    vm.assume(_spokeAddress1 != address(0) && _spokeAddress2 != address(0) && _spokeAddress3 != address(0));
    vm.assume(_spokeAddress1 != _spokeAddress2 && _spokeAddress1 != _spokeAddress3 && _spokeAddress2 != _spokeAddress3);
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
    _warpToValidTimestamp();

    uint64 timestamp = uint64(vm.getBlockTimestamp());
    uint64[] memory timestamps = new uint64[](3);
    timestamps[0] = timestamp;
    timestamps[1] = timestamp;
    timestamps[2] = timestamp;

    VoteWeight[] memory voteWeights = new VoteWeight[](3);
    voteWeights[0] = VoteWeight({voteWeight: _voteWeight1, chainId: 1, spokeAddress: _spokeAddress1});
    voteWeights[1] = VoteWeight({voteWeight: _voteWeight2, chainId: 2, spokeAddress: _spokeAddress2});
    voteWeights[2] = VoteWeight({voteWeight: _voteWeight3, chainId: 3, spokeAddress: _spokeAddress3});

    bool thresholdMet = _checkThresholdMet(voteWeights, 0, hubGovernor.proposalThreshold());
    vm.assume(thresholdMet);

    _registerSpokes(voteWeights);
    uint256 proposalId =
      _setupAndExecuteProposalIfEligibleCustomTimepoints(voteWeights, "Test Proposal", _caller, timestamps);

    assertTrue(proposalId > 0, "Proposal should be created");
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

    vm.expectRevert(CrossChainAggregateProposer.InsufficientVoteWeight.selector);
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
      abi.encodeWithSelector(CrossChainAggregateProposer.InvalidCaller.selector, _caller, _expectedAccount)
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

    vm.expectRevert(
      abi.encodeWithSelector(CrossChainAggregateProposer.UnregisteredSpoke.selector, _chainId, _spokeAddress)
    );
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

    vm.expectRevert(
      abi.encodeWithSelector(CrossChainAggregateProposer.UnregisteredSpoke.selector, _chainId, _queriedSpokeAddress)
    );

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

    vm.expectRevert(abi.encodeWithSelector(CrossChainAggregateProposer.TooManyEthCallResults.selector, 2));
    vm.prank(_caller);
    crossChainAggregateProposer.checkAndProposeIfEligible(targets, values, calldatas, _description, _resp, signatures);
  }

  function testFuzz_RevertIf_InvalidTimestamp(address _caller, uint128 _voteWeight1, uint128 _voteWeight2) public {
    vm.assume(_caller != address(0) && _caller != address(crossChainAggregateProposer.owner()));
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

    vm.expectRevert(CrossChainAggregateProposer.InvalidTimestamp.selector);
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

    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, address(hubGovernor), timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(CrossChainAggregateProposer.InvalidTimestamp.selector));
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

    bytes memory queryResponse = _mockQueryResponseWithCustomTimestamps(voteWeights, address(hubGovernor), timestamps);
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();
    address[] memory targets = builder.targets();
    uint256[] memory values = builder.values();
    bytes[] memory calldatas = builder.calldatas();

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(CrossChainAggregateProposer.InvalidTimestamp.selector));
    crossChainAggregateProposer.checkAndProposeIfEligible(
      targets, values, calldatas, "Test Proposal", queryResponse, signatures
    );
  }
}

contract RegisterSpoke is CrossChainAggregateProposerTest {
  function testFuzz_CorrectlyRegisterSpoke(uint16 _chainId, address _spokeAddress) public {
    vm.assume(_spokeAddress != address(0));

    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.registerSpoke(_chainId, _spokeAddress);

    assertEq(crossChainAggregateProposer.registeredSpokes(_chainId), _spokeAddress);
  }

  function testFuzz_EmitsSpokeRegistered(uint16 _chainId, address _spokeAddress) public {
    vm.assume(_spokeAddress != address(0));

    vm.prank(crossChainAggregateProposer.owner());
    vm.expectEmit();
    emit CrossChainAggregateProposer.SpokeRegistered(_chainId, _spokeAddress);
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

contract SetMaxQueryTimestampOffset is CrossChainAggregateProposerTest {
  function testFuzz_CorrectlySetMaxQueryTimestampOffset(uint48 _maxQueryTimestampOffset) public {
    vm.assume(_maxQueryTimestampOffset != 0);
    vm.prank(crossChainAggregateProposer.owner());
    crossChainAggregateProposer.setMaxQueryTimestampOffset(_maxQueryTimestampOffset);
    assertEq(crossChainAggregateProposer.maxQueryTimestampOffset(), _maxQueryTimestampOffset);
  }

  function testFuzz_EmitsMaxQueryTimestampOffsetUpdatedEvent(uint48 _maxQueryTimestampOffset) public {
    vm.assume(_maxQueryTimestampOffset != 0);
    vm.expectEmit();
    emit CrossChainAggregateProposer.MaxQueryTimestampOffsetUpdated(
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
    vm.expectRevert(CrossChainAggregateProposer.InvalidTimeDelta.selector);
    crossChainAggregateProposer.setMaxQueryTimestampOffset(0);
  }
}

contract _ExtractAccountFromCalldata is CrossChainAggregateProposerTest {
  function testFuzz_CorrectlyExtractsAccountFromCalldata(address _account) public view {
    // Simulate the calldata for a getVotes(address) function call
    bytes4 selector = bytes4(keccak256("getVotes(address)"));
    bytes memory callData = abi.encodeWithSelector(selector, _account);

    address extractedAccount = crossChainAggregateProposer.exposed_extractAccountFromCalldata(callData);
    assertEq(extractedAccount, _account, "Extracted account should match the input account");
  }

  function testFuzz_RevertIf_InvalidCallDataLength(bytes memory _callData) public {
    vm.assume(_callData.length < 24);
    vm.expectRevert(CrossChainAggregateProposer.InvalidCallDataLength.selector);
    crossChainAggregateProposer.exposed_extractAccountFromCalldata(_callData);
  }
}
