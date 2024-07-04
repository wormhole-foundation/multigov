// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {EmptyWormholeAddress} from "wormhole/query/QueryResponse.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {HubVotePool} from "src/HubVotePool.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";

import {HubVotePoolHarness} from "test/harnesses/HubVotePoolHarness.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";

contract HubVotePoolTest is WormholeEthQueryTest, AddressUtils {
  HubVotePoolHarness hubVotePool;
  GovernorMock governor;
  uint16 QUERY_CHAIN_ID = 2;
  uint48 minimumTime = 1 hours;

  struct VoteParams {
    uint256 proposalId;
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  function setUp() public {
    _setupWormhole();
    governor = new GovernorMock();
    hubVotePool = new HubVotePoolHarness(
      address(wormhole), address(governor), new HubVotePool.SpokeVoteAggregator[](0), 1 days, minimumTime
    );
  }

  function _boundProposalSafeWindow(uint48 _voteStart, uint48 _safeWindow) internal pure returns (uint48, uint48) {
    _voteStart = uint48(bound(_voteStart, 1, type(uint48).max - 3));
    _safeWindow = uint48(bound(_safeWindow, 1, type(uint48).max - _voteStart - 2));
    return (_voteStart, _safeWindow);
  }

  function _buildArbitraryQuery(VoteParams memory _voteParams, uint16 _responseChainId, address _governance)
    internal
    view
    returns (bytes memory)
  {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
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
        hubVotePool.QT_ETH_CALL(),
        ethCall
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
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
      QueryTest.buildPerChainResponseBytes(_responseChainId, hubVotePool.QT_ETH_CALL(), ethCallResp)
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

    (uint128 existingAgainstVotes, uint128 existingForVotes, uint128 existingAbstainVotes) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams.proposalId)));

    hubVotePool.crossChainEVMVote(_resp, signatures);

    return (_voteParams, _queryChainId);
  }

  function _assertVotesEq(
    VoteParams memory _voteParams,
    uint16 _queryChainId,
    SpokeCountingFractional.ProposalVote memory _proposalVotes
  ) internal view {
    assertEq(_proposalVotes.againstVotes, _voteParams.againstVotes);
    assertEq(_proposalVotes.forVotes, _voteParams.forVotes);
    assertEq(_proposalVotes.abstainVotes, _voteParams.abstainVotes);
  }
}

contract Constructor is Test, AddressUtils {
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

  function testFuzz_CorrectlySetConstructorArgs(
    address _core,
    address _hubGovernor,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry,
    uint32 _safeWindow,
    uint48 _minimumTime
  ) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));
    vm.assume(_isUnique(_initialSpokeRegistry));

    HubVotePool hubVotePool = new HubVotePool(_core, _hubGovernor, _initialSpokeRegistry, _safeWindow, _minimumTime);

    _assertSpokesRegistered(hubVotePool.spokeRegistry, _initialSpokeRegistry);
    assertEq(address(hubVotePool.WORMHOLE_CORE()), _core);
    assertEq(address(hubVotePool.hubGovernor()), _hubGovernor);
    assertEq(hubVotePool.safeWindow(), _safeWindow);
    assertEq(hubVotePool.minimumDecisionWindow(), _minimumTime);
  }

  function testFuzz_CorrectlyEmitsSpokeRegisteredEvent(
    address _core,
    address _hubGovernor,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry,
    uint48 _minimumTime
  ) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));
    vm.assume(_isUnique(_initialSpokeRegistry));

    for (uint256 i = 0; i < _initialSpokeRegistry.length; i++) {
      vm.expectEmit();
      emit HubVotePool.SpokeRegistered(
        _initialSpokeRegistry[i].wormholeChainId,
        addressToBytes32(address(0)),
        addressToBytes32(_initialSpokeRegistry[i].addr)
      );
    }

    new HubVotePool(_core, _hubGovernor, _initialSpokeRegistry, 1 days, _minimumTime);
  }

  function testFuzz_ConstructorWithEmptySpokeRegistry(
    address _core,
    address _hubGovernor,
    uint16 _spokeChainId,
    uint32 _safeWindow,
    uint48 _minimumTime
  ) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));

    HubVotePool.SpokeVoteAggregator[] memory emptyRegistry = new HubVotePool.SpokeVoteAggregator[](0);

    HubVotePool hubVotePool = new HubVotePool(_core, _hubGovernor, emptyRegistry, _safeWindow, _minimumTime);

    assertEq(address(hubVotePool.WORMHOLE_CORE()), _core);
    assertEq(address(hubVotePool.hubGovernor()), _hubGovernor);
    assertEq(hubVotePool.spokeRegistry(_spokeChainId), addressToBytes32(address(0)));
    assertEq(hubVotePool.spokeRegistry(_spokeChainId), addressToBytes32(address(0)));
    assertEq(hubVotePool.safeWindow(), _safeWindow);
  }

  function testFuzz_ConstructorWithNonEmptySpokeRegistry(
    address _core,
    address _hubGovernor,
    HubVotePool.SpokeVoteAggregator[] memory _nonEmptyInitialSpokeRegistry,
    uint32 _safeWindow,
    uint48 _minimumTime
  ) public {
    vm.assume(_nonEmptyInitialSpokeRegistry.length != 0);
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));
    vm.assume(_isUnique(_nonEmptyInitialSpokeRegistry));

    HubVotePool hubVotePool =
      new HubVotePool(_core, _hubGovernor, _nonEmptyInitialSpokeRegistry, _safeWindow, _minimumTime);

    _assertSpokesRegistered(hubVotePool.spokeRegistry, _nonEmptyInitialSpokeRegistry);

    assertEq(address(hubVotePool.WORMHOLE_CORE()), _core);
    assertEq(address(hubVotePool.hubGovernor()), _hubGovernor);
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(
    address _hubGovernor,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry,
    uint32 _safeWindow,
    uint48 _minimumTime
  ) public {
    vm.assume(_hubGovernor != address(0));
    vm.expectRevert(EmptyWormholeAddress.selector);
    new HubVotePool(address(0), _hubGovernor, _initialSpokeRegistry, _safeWindow, _minimumTime);
  }

  function testFuzz_RevertIf_HubGovernorIsZeroAddress(
    address _core,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry,
    uint32 _safeWindow,
    uint48 _minimumTime
  ) public {
    vm.assume(_core != address(0));
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new HubVotePool(_core, address(0), _initialSpokeRegistry, _safeWindow, _minimumTime);
  }
}

contract RegisterSpoke is HubVotePoolTest {
  function testFuzz_RegisterNewSpoke(uint16 _wormholeChainId, address _spokeContract) public {
    bytes32 spokeWormholeAddress = addressToBytes32(_spokeContract);
    vm.prank(address(governor));
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
    vm.prank(address(governor));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint16 _wormholeChainId, address _spokeContract, address _caller) public {
    vm.assume(_caller != address(governor));
    bytes32 spokeWormholeAddress = addressToBytes32(_spokeContract);
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
  }
}

contract SetGovernor is HubVotePoolTest {
  function testFuzz_CorrectlySetsGovernor(address _newGovernor) public {
    vm.prank(address(governor));
    hubVotePool.setGovernor(_newGovernor);
    assertEq(address(hubVotePool.hubGovernor()), _newGovernor);
  }

  function testFuzz_RevertIf_NotCalledByOwner(address _newGovernor, address _caller) public {
    vm.assume(_caller != address(governor));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.setGovernor(_newGovernor);
  }
}

contract CrossChainEVMVote is HubVotePoolTest {
  function testFuzz_CorrectlyAddNewVote(VoteParams memory _voteParams, address _spokeContract, uint16 _queryChainId)
    public
  {
    vm.assume(_spokeContract != address(0));

    vm.prank(address(governor));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    _sendCrossChainVote(_voteParams, _queryChainId, _spokeContract);

    assertEq(governor.proposalId(), _voteParams.proposalId);
    assertEq(governor.support(), 1);
    assertEq(governor.reason(), "rolled-up vote from governance spoke token holders");
    assertEq(
      governor.params(), abi.encodePacked(_voteParams.againstVotes, _voteParams.forVotes, _voteParams.abstainVotes)
    );

    (uint128 _againstVotes, uint128 _forVotes, uint128 _abstainVotes) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams.proposalId)));
    _assertVotesEq(
      _voteParams,
      _queryChainId,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      })
    );
  }

  function testFuzz_CorrectlyAddNewVoteMultipleQueries(
    VoteParams memory _voteParams1,
    VoteParams memory _voteParams2,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    vm.assume(_spokeContract != address(0));

    _voteParams2.forVotes = uint128(bound(_voteParams2.forVotes, _voteParams1.forVotes, type(uint128).max));
    _voteParams2.againstVotes = uint128(bound(_voteParams2.againstVotes, _voteParams1.againstVotes, type(uint128).max));
    _voteParams2.abstainVotes = uint128(bound(_voteParams2.abstainVotes, _voteParams1.abstainVotes, type(uint128).max));

    vm.prank(address(governor));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    _sendCrossChainVote(_voteParams1, _queryChainId, _spokeContract);

    (uint128 _againstVotes1, uint128 _forVotes1, uint128 _abstainVotes1) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams1.proposalId)));
    _assertVotesEq(
      _voteParams1,
      _queryChainId,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes1,
        forVotes: _forVotes1,
        abstainVotes: _abstainVotes1
      })
    );

    _sendCrossChainVote(_voteParams2, _queryChainId, _spokeContract);
    (uint128 _againstVotes2, uint128 _forVotes2, uint128 _abstainVotes2) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId, _voteParams2.proposalId)));
    _assertVotesEq(
      _voteParams2,
      _queryChainId,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes2,
        forVotes: _forVotes2,
        abstainVotes: _abstainVotes2
      })
    );
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

    vm.startPrank(address(governor));
    hubVotePool.registerSpoke(_queryChainId1, addressToBytes32(_spokeContract1));
    hubVotePool.registerSpoke(_queryChainId2, addressToBytes32(_spokeContract2));
    vm.stopPrank();

    _sendCrossChainVote(_voteParams1, _queryChainId1, _spokeContract1);
    (uint128 _againstVotes1, uint128 _forVotes1, uint128 _abstainVotes1) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(_queryChainId1, _voteParams1.proposalId)));
    _assertVotesEq(
      _voteParams1,
      _queryChainId1,
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
      _queryChainId2,
      SpokeCountingFractional.ProposalVote({
        againstVotes: _againstVotes2,
        forVotes: _forVotes2,
        abstainVotes: _abstainVotes2
      })
    );
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

    vm.prank(address(governor));
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

    hubVotePool.crossChainEVMVote(_resp, signatures);
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
    hubVotePool.crossChainEVMVote(_invalidResp, signatureForInvalidResp);
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

    vm.expectRevert(HubVotePool.UnknownMessageEmitter.selector);
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }

  function test_RevertIf_TooManyResponseItemsInResponseBytes(
    uint256 _proposalId,
    uint128 _againstVotes,
    uint128 _forVotes,
    uint128 _abstainVotes
  ) public {
    vm.prank(address(governor));
    hubVotePool.registerSpoke(2, addressToBytes32(GOVERNANCE_CONTRACT));

    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      1, // numCallData
      QueryTest.buildEthCallDataBytes(address(governor), abi.encodeWithSignature("proposalVotes(uint256)", _proposalId))
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      2, // num per chain requests
      abi.encodePacked(
        QueryTest.buildPerChainRequestBytes(
          2, // chainId: (Ethereum mainnet)
          hubVotePool.QT_ETH_CALL(),
          ethCall
        ),
        QueryTest.buildPerChainRequestBytes(
          2, // chainId: (Ethereum mainnet)
          hubVotePool.QT_ETH_CALL(),
          ethCall
        )
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_againstVotes),
            forVotes: uint128(_forVotes),
            abstainVotes: uint128(_abstainVotes)
          })
        )
      )
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      2, // num per chain responses
      abi.encodePacked(
        QueryTest.buildPerChainResponseBytes(2, hubVotePool.QT_ETH_CALL(), ethCallResp),
        QueryTest.buildPerChainResponseBytes(2, hubVotePool.QT_ETH_CALL(), ethCallResp)
      )
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(abi.encodeWithSelector(HubVotePool.TooManyQueryResponses.selector, 2));
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }

  function testFuzz_RevertIf_TooManyCalls(uint16 _queryChainId, address _spokeContract) public {
    vm.assume(_spokeContract != address(0));

    vm.prank(address(governor));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      2, // numCallData
      abi.encodePacked(
        QueryTest.buildEthCallDataBytes(
          _spokeContract, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", 1, 2, 3)
        ),
        QueryTest.buildEthCallDataBytes(_spokeContract, abi.encodeWithSignature("proposalVotes(uint256)", 1))
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(_queryChainId, hubVotePool.QT_ETH_CALL(), ethCall)
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
      QueryTest.buildPerChainResponseBytes(_queryChainId, hubVotePool.QT_ETH_CALL(), ethCallResp)
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(abi.encodeWithSelector(HubVotePool.TooManyEthCallResults.selector, 2));
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }

  function testFuzz_RevertIf_SpokeContractIsZeroAddress(VoteParams memory _voteParams, uint16 _queryChainId) public {
    bytes memory _resp = _buildArbitraryQuery(_voteParams, _queryChainId, address(0));

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);

    vm.expectRevert(HubVotePool.UnknownMessageEmitter.selector);
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }
}

contract SetSafeWindow is HubVotePoolTest {
  function testFuzz_CorrectlySetSafeWindow(uint48 _safeWindow) public {
    _safeWindow = uint48(bound(_safeWindow, minimumTime, governor.votingPeriod() - 1 hours));
    vm.prank(address(governor));
    hubVotePool.setSafeWindow(_safeWindow);
    assertEq(hubVotePool.safeWindow(), _safeWindow);
  }

  function testFuzz_UpdatingSafeWindowEmitsASetSafeWindowUpdatedEvent(uint48 _safeWindow) public {
    _safeWindow = uint48(bound(_safeWindow, minimumTime, governor.votingPeriod() - 1 hours));
    vm.expectEmit();
    emit HubVotePool.SafeWindowUpdated(hubVotePool.safeWindow(), _safeWindow);
    vm.prank(address(governor));
    hubVotePool.setSafeWindow(_safeWindow);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint48 _safeWindow, address _caller) public {
    vm.assume(address(governor) != _caller);

    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.setSafeWindow(_safeWindow);
  }
}

contract IsVotingSafe is HubVotePoolTest {
  function testFuzz_GetIsProposalSafeForSafeProposal(uint16 _safeWindow, uint256 _proposalId, uint48 _voteStart) public {
    vm.assume(_safeWindow != 0);
    vm.assume(_proposalId != 0);
    _voteStart = uint48(bound(_voteStart, 1, type(uint48).max - _safeWindow));
    hubVotePool.exposed_setSafeWindow(_safeWindow);
    ProposalBuilder builder = new ProposalBuilder();
    vm.warp(_voteStart);
    governor.propose(builder.targets(), builder.values(), builder.calldatas(), "");
    bool isSafe = hubVotePool.isVotingSafe(_proposalId);
    assertEq(isSafe, true);
  }

  function testFuzz_GetIsProposalSafeForUnsafeProposal(uint48 _safeWindow, uint256 _proposalId, uint48 _voteStart)
    public
  {
    vm.assume(_safeWindow != 0);
    vm.assume(_proposalId != 0);
    (_voteStart, _safeWindow) = _boundProposalSafeWindow(_voteStart, _safeWindow);
    hubVotePool.exposed_setSafeWindow(_safeWindow);
    ProposalBuilder builder = new ProposalBuilder();
    vm.warp(_voteStart);
    governor.propose(builder.targets(), builder.values(), builder.calldatas(), "");

    vm.warp(_voteStart + _safeWindow + 1);
    bool isSafe = hubVotePool.isVotingSafe(_proposalId);
    assertEq(isSafe, false);
  }
}
