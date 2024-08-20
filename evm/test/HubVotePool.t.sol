// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {QueryResponse} from "wormhole-sdk/QueryResponse.sol";
import {EmptyWormholeAddress, InvalidContractAddress} from "wormhole-sdk/QueryResponse.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HubEvmSpokeVoteDecoder} from "src/HubEvmSpokeVoteDecoder.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ERC165Fake} from "test/fakes/ERC165Fake.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {SpokeMetadataCollectorHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";

contract HubVotePoolTest is WormholeEthQueryTest, AddressUtils {
  HubVotePool hubVotePool;
  HubGovernorHarness public hubGovernor;
  uint48 minimumTime = 1 hours;
  uint8 ethCallQuery;
  TimelockControllerFake public timelock;
  ERC20VotesFake token;
  HubProposalMetadata hubProposalMetadata;
  HubEvmSpokeVoteDecoder hubCrossChainEvmVote;
  SpokeVoteAggregator spokeVoteAggregator;
  HubProposalExtender public extender;

  uint48 public constant INITIAL_VOTING_DELAY = 1 days;
  uint32 public constant INITIAL_VOTING_PERIOD = 1 days;
  uint208 public constant INITIAL_QUORUM = 100e18;
  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;
  uint48 public constant VOTE_WEIGHT_WINDOW = 1 days;
  uint48 public constant VOTE_TIME_EXTENSION = 1 days;
  uint48 public constant MINIMUM_VOTE_EXTENSION = 1 hours;
  uint48 public constant INITIAL_VOTING_WINDOW = 1 days;
  uint16 public constant HUB_CHAIN_ID = MAINNET_CHAIN_ID;
  uint16 public constant SPOKE_CHAIN_ID = 3;

  struct VoteParams {
    uint256 proposalId;
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  function setUp() public {
    _setupWormhole();
    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();
    extender = new HubProposalExtender(initialOwner, VOTE_TIME_EXTENSION, initialOwner, MINIMUM_VOTE_EXTENSION);

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: "Test Gov",
      token: token,
      timelock: timelock,
      initialVotingDelay: INITIAL_VOTING_DELAY,
      initialVotingPeriod: INITIAL_VOTING_PERIOD,
      initialProposalThreshold: PROPOSAL_THRESHOLD,
      initialQuorum: INITIAL_QUORUM,
      hubVotePoolOwner: address(timelock),
      wormholeCore: address(wormhole),
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: VOTE_WEIGHT_WINDOW
    });

    hubGovernor = new HubGovernorHarness(params);
    hubVotePool = hubGovernor.hubVotePool();
    hubCrossChainEvmVote = new HubEvmSpokeVoteDecoder(address(wormhole), address(hubVotePool));
    hubProposalMetadata = new HubProposalMetadata(address(hubGovernor));
    spokeMetadataCollector =
      new SpokeMetadataCollectorHarness(address(wormhole), HUB_CHAIN_ID, address(hubProposalMetadata));
    spokeVoteAggregator =
      new SpokeVoteAggregator(address(spokeMetadataCollector), address(token), address(timelock), INITIAL_VOTING_WINDOW);

    ethCallQuery = hubVotePool.QT_ETH_CALL_WITH_FINALITY();
    vm.startPrank(address(timelock));
    hubVotePool.registerQueryType(ethCallQuery, address(hubCrossChainEvmVote));
    vm.stopPrank();
  }

  function _mintAndDelegate(address user, uint256 amount) public returns (address) {
    token.mint(user, amount);
    vm.prank(user);
    token.delegate(user);
    vm.warp(vm.getBlockTimestamp() + 1);
    return user;
  }

  function _buildArbitraryQuery(VoteParams memory _voteParams, uint16 _responseChainId, address _governance)
    internal
    view
    returns (bytes memory)
  {
    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      "finalized", // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _governance, abi.encodeWithSignature("proposalVotes(uint256)", _voteParams.proposalId)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        _responseChainId, // chainId: (Ethereum mainnet)
        hubVotePool.QT_ETH_CALL_WITH_FINALITY(),
        ethCall
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _voteParams.proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_voteParams.againstVotes),
            forVotes: uint128(_voteParams.forVotes),
            abstainVotes: uint128(_voteParams.abstainVotes)
          })
        )
      ) // results
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(_responseChainId, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp)
    );
    return _resp;
  }

  function _getSignatures(bytes memory _resp) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }

  function _sendCrossChainVote(VoteParams memory _voteParams, uint16 _queryChainId, address _spokeContract)
    internal
    returns (VoteParams memory, uint16)
  {
    bytes memory _resp = _buildArbitraryQuery(_voteParams, _queryChainId, _spokeContract);
    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams.proposalId)));

    hubVotePool.crossChainVote(_resp, signatures);

    return (_voteParams, _queryChainId);
  }

  function _assertVotesEq(VoteParams memory _voteParams, SpokeCountingFractional.ProposalVote memory _proposalVotes)
    internal
    pure
  {
    assertEq(_proposalVotes.againstVotes, _voteParams.againstVotes);
    assertEq(_proposalVotes.forVotes, _voteParams.forVotes);
    assertEq(_proposalVotes.abstainVotes, _voteParams.abstainVotes);
  }

  function _buildSpokeProposalVoteResponse(uint256 _proposalId) internal view returns (bytes memory) {
    (uint256 proposalId, uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) =
      spokeVoteAggregator.proposalVotes(_proposalId);

    bytes memory callData = abi.encodeWithSignature("proposalVotes(uint256)", _proposalId);
    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), "finalized", 1, QueryTest.buildEthCallDataBytes(address(spokeVoteAggregator), callData)
    );

    bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, 0, 1, QueryTest.buildPerChainRequestBytes(SPOKE_CHAIN_ID, ethCallQuery, ethCall)
    );

    bytes memory result = abi.encode(
      proposalId,
      SpokeCountingFractional.ProposalVote({
        againstVotes: uint128(againstVotes),
        forVotes: uint128(forVotes),
        abstainVotes: uint128(abstainVotes)
      })
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(vm.getBlockNumber()),
      blockhash(vm.getBlockNumber()),
      uint64(vm.getBlockTimestamp()),
      1,
      QueryTest.buildEthCallResultBytes(result)
    );

    return QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      queryRequestBytes,
      1,
      QueryTest.buildPerChainResponseBytes(SPOKE_CHAIN_ID, ethCallQuery, ethCallResp)
    );
  }

  function _getActualProposalMetadata(uint256 _proposalId, address _hubProposalMetadata)
    internal
    view
    returns (uint256 returnedProposalId, uint256 voteStart)
  {
    (returnedProposalId, voteStart) = HubProposalMetadata(_hubProposalMetadata).getProposalMetadata(_proposalId);
    require(returnedProposalId == _proposalId, "Proposal ID mismatch");
  }

  function _buildAddProposalQuery(uint256 _proposalId, uint16 _responseChainId, address _hubProposalMetadata)
    internal
    view
    returns (bytes memory)
  {
    (uint256 returnedProposalId, uint256 voteStart) = _getActualProposalMetadata(_proposalId, _hubProposalMetadata);

    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      "finalized", // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _hubProposalMetadata, abi.encodeWithSignature("getProposalMetadata(uint256)", _proposalId)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(_responseChainId, spokeMetadataCollector.QT_ETH_CALL_WITH_FINALITY(), ethCall)
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(vm.getBlockNumber()), // block number
      blockhash(vm.getBlockNumber()), // block hash
      uint64(vm.getBlockTimestamp()), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(abi.encode(returnedProposalId, voteStart)) // results
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(
        _responseChainId, spokeMetadataCollector.QT_ETH_CALL_WITH_FINALITY(), ethCallResp
      )
    );
    return _resp;
  }

  function _createEmptyProposal(address proposer) internal returns (uint256 proposalId) {
    address[] memory targets = new address[](1);
    uint256[] memory values = new uint256[](1);
    bytes[] memory calldatas = new bytes[](1);
    string memory description = "Test Proposal";

    hubGovernor.exposed_setWhitelistedProposer(proposer);
    vm.prank(proposer);
    proposalId = hubGovernor.propose(targets, values, calldatas, description);

    bytes memory queryResponseRaw =
      _buildAddProposalQuery(proposalId, uint16(HUB_CHAIN_ID), address(hubProposalMetadata));

    IWormhole.Signature[] memory signatures = _getSignatures(queryResponseRaw);

    spokeMetadataCollector.addProposal(queryResponseRaw, signatures);

    return proposalId;
  }
}

contract Constructor is Test, AddressUtils {
  function testFuzz_CorrectlySetConstructorArgs(address _core, address _hubGovernor, address _timelock) public {
    vm.assume(_core != address(0));
    vm.assume(_timelock != address(0));

    HubVotePool hubVotePool = new HubVotePool(_core, _hubGovernor, _timelock);

    assertEq(address(hubVotePool.hubGovernor()), _hubGovernor);
    assertEq(hubVotePool.owner(), _timelock);
    assertNotEq(address(hubVotePool.voteTypeDecoder(hubVotePool.QT_ETH_CALL_WITH_FINALITY())), address(0));
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(address _hubGovernor, address _timelock) public {
    vm.expectRevert(EmptyWormholeAddress.selector);
    new HubVotePool(address(0), _hubGovernor, _timelock);
  }

  function testFuzz_RevertIf_TimelockIsZeroAddress(address _core, address _governor) public {
    vm.assume(_core != address(0));
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new HubVotePool(_core, _governor, address(0));
  }
}

contract RegisterQueryType is HubVotePoolTest {
  function testFuzz_CorrectlySetCrossChainVote(uint8 _queryType) public {
    vm.startPrank(address(timelock));
    hubVotePool.registerQueryType(_queryType, address(hubCrossChainEvmVote));
    vm.stopPrank();
    assertEq(address(hubVotePool.voteTypeDecoder(_queryType)), address(hubCrossChainEvmVote));
  }

  function testFuzz_RegisteringQueryTypeEmitsQueryTypeRegisteredEvent(uint8 _queryType) public {
    vm.startPrank(address(timelock));
    ISpokeVoteDecoder current = hubVotePool.voteTypeDecoder(_queryType);
    vm.expectEmit();
    emit HubVotePool.QueryTypeRegistered(_queryType, address(current), address(hubCrossChainEvmVote));
    hubVotePool.registerQueryType(_queryType, address(hubCrossChainEvmVote));
    vm.stopPrank();
  }

  function testFuzz_CorrectlyResetQueryTypeToZeroAddress(uint8 _queryType) public {
    vm.startPrank(address(timelock));
    hubVotePool.registerQueryType(_queryType, address(hubCrossChainEvmVote));
    hubVotePool.registerQueryType(_queryType, address(0));
    vm.stopPrank();
    assertEq(address(hubVotePool.voteTypeDecoder(_queryType)), address(0));
  }

  function testFuzz_RevertIf_ERC165IsNotSupported(uint8 queryType) public {
    vm.startPrank(address(timelock));
    GovernorMock gov = new GovernorMock();
    vm.expectRevert(HubVotePool.InvalidQueryVoteImpl.selector);
    hubVotePool.registerQueryType(queryType, address(gov));
    vm.stopPrank();
  }

  function testFuzz_RevertIf_TheCrossChainVoteInterfaceIsNotSupported(uint8 _queryType) public {
    vm.startPrank(address(timelock));
    ERC165Fake impl = new ERC165Fake();
    vm.expectRevert(HubVotePool.InvalidQueryVoteImpl.selector);
    hubVotePool.registerQueryType(_queryType, address(impl));
    vm.stopPrank();
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint8 _queryType, address _caller) public {
    vm.assume(_caller != address(timelock));
    vm.startPrank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.registerQueryType(_queryType, address(hubCrossChainEvmVote));
    vm.stopPrank();
  }
}

contract RegisterSpoke is HubVotePoolTest {
  function testFuzz_RegisterNewSpoke(uint16 _wormholeChainId, address _spokeContract) public {
    bytes32 spokeWormholeAddress = addressToBytes32(_spokeContract);
    vm.prank(address(timelock));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
    bytes32 wormholeAddress = hubVotePool.spokeRegistry(_wormholeChainId);
    assertEq(wormholeAddress, spokeWormholeAddress);
  }

  function testFuzz_CorrectlyEmitsSpokeRegisteredEvent(uint16 _wormholeChainId, address _spokeContract) public {
    bytes32 spokeWormholeAddress = addressToBytes32(_spokeContract);
    vm.expectEmit();
    emit HubVotePool.SpokeRegistered(
      _wormholeChainId, hubVotePool.spokeRegistry(_wormholeChainId), spokeWormholeAddress
    );
    vm.prank(address(timelock));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint16 _wormholeChainId, address _spokeContract, address _caller) public {
    vm.assume(_caller != address(timelock));
    bytes32 spokeWormholeAddress = addressToBytes32(_spokeContract);
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
  }
}

contract RegisterSpokes is HubVotePoolTest {
  mapping(uint16 => bool) public initialSpokeRegistrySeen;

  function _isUnique(HubVotePool.SpokeVoteAggregator[] memory _array) internal returns (bool) {
    for (uint256 i = 0; i < _array.length; i++) {
      uint16 chainId = _array[i].wormholeChainId;
      if (initialSpokeRegistrySeen[chainId]) return false;
      initialSpokeRegistrySeen[chainId] = true;
    }
    return true;
  }

  function _assertSpokesRegistered(
    function(uint16) external view returns (bytes32) spokeRegistryFunc,
    HubVotePool.SpokeVoteAggregator[] memory _spokeRegistry
  ) internal view {
    for (uint256 i = 0; i < _spokeRegistry.length; i++) {
      uint16 chainId = _spokeRegistry[i].wormholeChainId;
      bytes32 expectedAddress = addressToBytes32(_spokeRegistry[i].addr);
      bytes32 storedAddress = spokeRegistryFunc(chainId);
      assertEq(storedAddress, expectedAddress);
    }
  }

  function testFuzz_RegisterNewSpokes(HubVotePool.SpokeVoteAggregator[] memory _spokes) public {
    vm.assume(_isUnique(_spokes));
    vm.prank(address(timelock));
    hubVotePool.registerSpokes(_spokes);
    _assertSpokesRegistered(hubVotePool.spokeRegistry, _spokes);
  }

  function testFuzz_CorrectlyEmitsSpokeRegisteredEvent(HubVotePool.SpokeVoteAggregator[] memory _spokes) public {
    vm.assume(_isUnique(_spokes));

    for (uint256 i = 0; i < _spokes.length; i++) {
      vm.expectEmit();
      emit HubVotePool.SpokeRegistered(
        _spokes[i].wormholeChainId, addressToBytes32(address(0)), addressToBytes32(_spokes[i].addr)
      );
    }

    vm.prank(address(timelock));
    hubVotePool.registerSpokes(_spokes);
  }

  function testFuzz_RevertIf_NotCalledByOwner(HubVotePool.SpokeVoteAggregator[] memory _spokes, address _caller) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.registerSpokes(_spokes);
  }
}

contract SetGovernor is HubVotePoolTest {
  function testFuzz_CorrectlySetsGovernor(address _newGovernor) public {
    vm.prank(address(timelock));
    hubVotePool.setGovernor(_newGovernor);
    assertEq(address(hubVotePool.hubGovernor()), _newGovernor);
  }

  function testFuzz_RevertIf_NotCalledByOwner(address _newGovernor, address _caller) public {
    vm.assume(_caller != address(timelock));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.setGovernor(_newGovernor);
  }
}

contract CrossChainVote is HubVotePoolTest, ProposalTest {
  function testFuzz_ActualCallHappyPath(address _proposer) public {
    vm.assume(_proposer != address(0));
    _setGovernor(hubGovernor);

    vm.prank(address(timelock));
    hubVotePool.registerSpoke(SPOKE_CHAIN_ID, addressToBytes32(address(spokeVoteAggregator)));

    address[3] memory voters = [address(0x1), address(0x2), address(0x3)];
    uint256[3] memory voteWeights = [uint256(100e18), uint256(200e18), uint256(300e18)];
    for (uint8 i = 0; i < 3; i++) {
      _mintAndDelegate(voters[i], voteWeights[i]);
    }

    uint256 proposalId = _createEmptyProposal(_proposer);

    _jumpToActiveProposal(proposalId);

    uint8[3] memory voteTypes = [0, 1, 2]; // Against, For, Abstain
    for (uint8 i = 0; i < 3; i++) {
      vm.prank(voters[i]);
      spokeVoteAggregator.castVote(proposalId, voteTypes[i]);
    }

    bytes memory voteQueryResponse = _buildSpokeProposalVoteResponse(proposalId);
    IWormhole.Signature[] memory voteSignatures = _getSignatures(voteQueryResponse);

    hubVotePool.crossChainVote(voteQueryResponse, voteSignatures);

    (uint128 _againstVotes, uint128 _forVotes, uint128 _abstainVotes) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(SPOKE_CHAIN_ID, proposalId)));

    assertEq(_againstVotes, voteWeights[0]);
    assertEq(_forVotes, voteWeights[1]);
    assertEq(_abstainVotes, voteWeights[2]);

    // Verify that the votes were correctly submitted to the HubGovernor
    (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = hubGovernor.proposalVotes(proposalId);
    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);

    // Verify that HubGovernor recognizes the vote from HubVotePool
    assertTrue(hubGovernor.hasVoted(proposalId, address(hubVotePool)));
  }

  function testFuzz_CorrectlyAddNewVote(VoteParams memory _voteParams, address _spokeContract, uint16 _queryChainId)
    public
  {
    vm.assume(_spokeContract != address(0));

    vm.prank(address(timelock));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    _sendCrossChainVote(_voteParams, _queryChainId, _spokeContract);

    // assertEq(hubGovernor.proposalId(), _voteParams.proposalId);
    // assertEq(hubGovernor.support(), 1);
    // assertEq(hubGovernor.reason(), "rolled-up vote from governance spoke token holders");
    // assertEq(
    //   hubGovernor.params(), abi.encodePacked(_voteParams.againstVotes, _voteParams.forVotes,
    // _voteParams.abstainVotes)
    // );

    (uint128 _againstVotes, uint128 _forVotes, uint128 _abstainVotes) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams.proposalId)));
    _assertVotesEq(
      _voteParams,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      })
    );
  }

  function testFuzz_CorrectlyAddNewVoteWithMultipleQueriesFromTheSameSpoke(
    VoteParams memory _voteParams1,
    VoteParams memory _voteParams2,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    vm.assume(_spokeContract != address(0));
    _queryChainId = uint16(bound(_queryChainId, 5, type(uint16).max));

    vm.startPrank(address(timelock));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));
    vm.stopPrank();

    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      "finalized", // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _spokeContract, abi.encodeWithSignature("proposalVotes(uint256)", _voteParams1.proposalId)
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _voteParams1.proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_voteParams1.againstVotes),
            forVotes: uint128(_voteParams1.forVotes),
            abstainVotes: uint128(_voteParams1.abstainVotes)
          })
        )
      ) // results
    );

    _voteParams2.againstVotes = uint128(bound(_voteParams2.againstVotes, _voteParams1.againstVotes, type(uint128).max));
    _voteParams2.forVotes = uint128(bound(_voteParams2.forVotes, _voteParams1.forVotes, type(uint128).max));
    _voteParams2.abstainVotes = uint128(bound(_voteParams2.abstainVotes, _voteParams1.abstainVotes, type(uint128).max));
    bytes memory secondEthCallResp = QueryTest.buildEthCallResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _voteParams1.proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_voteParams2.againstVotes),
            forVotes: uint128(_voteParams2.forVotes),
            abstainVotes: uint128(_voteParams2.abstainVotes)
          })
        )
      ) // results
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      2, // num per chain requests
      abi.encodePacked(
        QueryTest.buildPerChainRequestBytes(
          _queryChainId, // chainId
          hubVotePool.QT_ETH_CALL_WITH_FINALITY(),
          ethCall
        ),
        QueryTest.buildPerChainRequestBytes(
          _queryChainId, // chainId
          hubVotePool.QT_ETH_CALL_WITH_FINALITY(),
          ethCall
        )
      )
    );

    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      2, // num per chain responses
      abi.encodePacked(
        QueryTest.buildPerChainResponseBytes(_queryChainId, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp),
        QueryTest.buildPerChainResponseBytes(_queryChainId, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), secondEthCallResp)
      )
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);
    hubVotePool.crossChainVote(_resp, signatures);

    (uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams1.proposalId)));

    assertEq(forVotes, _voteParams2.forVotes);
    assertEq(againstVotes, _voteParams2.againstVotes);
    assertEq(abstainVotes, _voteParams2.abstainVotes);
  }

  function testFuzz_CorrectlyAddNewVoteFromMultipleSpokes(
    VoteParams memory _voteParams,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    vm.assume(_spokeContract != address(0));
    _queryChainId = uint16(bound(_queryChainId, 2, type(uint16).max));

    vm.startPrank(address(timelock));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));
    hubVotePool.registerSpoke(_queryChainId - 1, addressToBytes32(_spokeContract));
    vm.stopPrank();

    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      "finalized", // finalized
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _spokeContract, abi.encodeWithSignature("proposalVotes(uint256)", _voteParams.proposalId)
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _voteParams.proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_voteParams.againstVotes),
            forVotes: uint128(_voteParams.forVotes),
            abstainVotes: uint128(_voteParams.abstainVotes)
          })
        )
      ) // results
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      2, // num per chain requests
      abi.encodePacked(
        QueryTest.buildPerChainRequestBytes(
          _queryChainId, // chainId
          hubVotePool.QT_ETH_CALL_WITH_FINALITY(),
          ethCall
        ),
        QueryTest.buildPerChainRequestBytes(
          _queryChainId - 1, // chainId
          hubVotePool.QT_ETH_CALL_WITH_FINALITY(),
          ethCall
        )
      )
    );

    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      2, // num per chain responses
      abi.encodePacked(
        QueryTest.buildPerChainResponseBytes(_queryChainId, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp),
        QueryTest.buildPerChainResponseBytes(_queryChainId - 1, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp)
      )
    );

    hubVotePool.crossChainVote(_resp, _getSignatures(_resp));

    (uint128 againstVotes1, uint128 forVotes1, uint128 abstainVotes1) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams.proposalId)));

    assertEq(forVotes1, _voteParams.forVotes);
    assertEq(againstVotes1, _voteParams.againstVotes);
    assertEq(abstainVotes1, _voteParams.abstainVotes);

    (uint128 againstVotes2, uint128 forVotes2, uint128 abstainVotes2) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId - 1, _voteParams.proposalId)));

    assertEq(forVotes2, _voteParams.forVotes);
    assertEq(againstVotes2, _voteParams.againstVotes);
    assertEq(abstainVotes2, _voteParams.abstainVotes);
  }

  function testFuzz_CorrectlyAddNewVoteMultipleChains(
    VoteParams memory _voteParams1,
    VoteParams memory _voteParams2,
    address _spokeContract1,
    address _spokeContract2,
    uint16 _queryChainId1,
    uint16 _queryChainId2
  ) public {
    vm.assume(_spokeContract1 != address(0) && _spokeContract2 != address(0));
    vm.assume(_queryChainId1 != _queryChainId2);

    vm.startPrank(address(timelock));
    hubVotePool.registerSpoke(_queryChainId1, addressToBytes32(_spokeContract1));
    hubVotePool.registerSpoke(_queryChainId2, addressToBytes32(_spokeContract2));
    vm.stopPrank();

    _sendCrossChainVote(_voteParams1, _queryChainId1, _spokeContract1);
    (uint128 _againstVotes1, uint128 _forVotes1, uint128 _abstainVotes1) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId1, _voteParams1.proposalId)));
    _assertVotesEq(
      _voteParams1,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes1,
        forVotes: _forVotes1,
        abstainVotes: _abstainVotes1
      })
    );

    _sendCrossChainVote(_voteParams2, _queryChainId2, _spokeContract2);
    (uint128 _againstVotes2, uint128 _forVotes2, uint128 _abstainVotes2) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId2, _voteParams2.proposalId)));
    _assertVotesEq(
      _voteParams2,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes2,
        forVotes: _forVotes2,
        abstainVotes: _abstainVotes2
      })
    );
  }

  function testFuzz_RevertIf_UnregisteredQueryType(
    uint256 _proposalId,
    uint64 _votes,
    address _spokeContract,
    uint16 _queryChainId,
    uint8 _queryType
  ) public {
    vm.assume(_spokeContract != address(0));
    vm.assume(_votes != 0);
    _queryType = uint8(bound(_queryType, 1, 5));
    vm.assume(_queryType != hubVotePool.QT_ETH_CALL_WITH_FINALITY());

    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      "finalized", // finalized
      1, // numCallData
      QueryTest.buildEthCallDataBytes(_spokeContract, abi.encodeWithSignature("proposalVotes(uint256)", _proposalId))
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        _queryChainId, // chainId: (Ethereum mainnet)
        _queryType,
        ethCall
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_votes),
            forVotes: uint128(_votes),
            abstainVotes: uint128(_votes)
          })
        )
      ) // results
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(_queryChainId, _queryType, ethCallResp)
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(HubVotePool.UnsupportedQueryType.selector);
    hubVotePool.crossChainVote(_resp, signatures);
  }

  function testFuzz_RevertIf_QueriedVotesAreLessThanOnHubVotePoolForSpoke(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    vm.assume(_spokeContract != address(0));
    vm.assume(_againstVotes != 0);

    vm.prank(address(timelock));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    bytes memory _resp = _buildArbitraryQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      _queryChainId,
      _spokeContract
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    hubVotePool.crossChainVote(_resp, signatures);
    bytes memory _invalidResp = _buildArbitraryQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes - 1,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      _queryChainId,
      _spokeContract
    );

    IWormhole.Signature[] memory signatureForInvalidResp = _getSignatures(_invalidResp);

    vm.expectRevert(HubVotePool.InvalidProposalVote.selector);
    hubVotePool.crossChainVote(_invalidResp, signatureForInvalidResp);
  }

  function testFuzz_RevertIf_SpokeIsNotRegistered(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    bytes memory _resp = _buildArbitraryQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      _queryChainId,
      _spokeContract
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(InvalidContractAddress.selector);
    hubVotePool.crossChainVote(_resp, signatures);
  }

  function testFuzz_RevertIf_TooManyCalls(uint16 _queryChainId, address _spokeContract) public {
    vm.assume(_spokeContract != address(0));

    vm.prank(address(timelock));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // blockId
      "finalized", // finality
      2, // numCallData
      abi.encodePacked(
        QueryTest.buildEthCallDataBytes(_spokeContract, abi.encodeWithSignature("proposalVotes(uint256)", 1, 2, 3)),
        QueryTest.buildEthCallDataBytes(_spokeContract, abi.encodeWithSignature("proposalVotes(uint256)", 1))
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(_queryChainId, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCall)
    );

    bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      2, // numResults
      abi.encodePacked(
        QueryTest.buildEthCallResultBytes(abi.encode(1, 2, 3)), QueryTest.buildEthCallResultBytes(abi.encode(1, 2, 3))
      ) // results
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(_queryChainId, hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp)
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(abi.encodeWithSelector(ISpokeVoteDecoder.TooManyEthCallResults.selector, 2));
    hubVotePool.crossChainVote(_resp, signatures);
  }

  function testFuzz_RevertIf_SpokeContractIsZeroAddress(VoteParams memory _voteParams, uint16 _queryChainId) public {
    bytes memory _resp = _buildArbitraryQuery(_voteParams, _queryChainId, address(0));

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(InvalidContractAddress.selector);
    hubVotePool.crossChainVote(_resp, signatures);
  }
}
