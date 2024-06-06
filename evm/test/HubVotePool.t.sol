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

import {GovernorMock} from "test/mocks/GovernorMock.sol";

contract HubVotePoolTest is WormholeEthQueryTest {
  HubVotePool hubVotePool;
  GovernorMock governor;
  uint16 QUERY_CHAIN_ID = 2;

  struct VoteParams {
    uint256 proposalId;
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  function setUp() public {
    _setupWormhole();
    governor = new GovernorMock();
    hubVotePool = new HubVotePool(address(wormhole), address(governor), new HubVotePool.SpokeVoteAggregator[](0));
  }

  function _buildAddVoteQuery(VoteParams memory _voteParams, uint16 _responseChainId, address _governance)
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
      QueryTest.buildPerChainResponseBytes(
        _responseChainId, // eth mainnet
        hubVotePool.QT_ETH_CALL(),
        ethCallResp
      )
    );
    return _resp;
  }
}

contract Constructor is Test {
  function testFuzz_CorrectlySetConstructorArgs(
    address _core,
    address _hubGovernor,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry
  ) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));

    HubVotePool hubVotePool = new HubVotePool(_core, _hubGovernor, _initialSpokeRegistry);

    for (uint256 i = 0; i < _initialSpokeRegistry.length; i++) {
      HubVotePool.SpokeVoteAggregator memory aggregator = _initialSpokeRegistry[i];
      bytes32 aggregatorAddress = bytes32(uint256(uint160(aggregator.addr)));
      assertEq(hubVotePool.spokeRegistry(aggregator.wormholeChainId), aggregatorAddress);
    }

    assertEq(address(hubVotePool.WORMHOLE_CORE()), _core);
    assertEq(address(hubVotePool.hubGovernor()), _hubGovernor);
    assertEq(hubVotePool.spokeRegistry(0), bytes32(0));
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(
    address _hubGovernor,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry
  ) public {
    vm.assume(_hubGovernor != address(0));
    vm.expectRevert(EmptyWormholeAddress.selector);
    new HubVotePool(address(0), _hubGovernor, _initialSpokeRegistry);
  }

  function testFuzz_RevertIf_HubGovernorIsZeroAddress(
    address _core,
    HubVotePool.SpokeVoteAggregator[] memory _initialSpokeRegistry
  ) public {
    vm.assume(_core != address(0));
    vm.expectRevert(Ownable.OwnableInvalidOwner.selector);
    new HubVotePool(_core, address(0), _initialSpokeRegistry);
  }
}

contract RegisterSpoke is HubVotePoolTest {
  function testFuzz_RegisterNewSpoke(uint16 _wormholeChainId, address _spokeContract) public {
    bytes32 spokeWormholeAddress = bytes32(uint256(uint160(_spokeContract)));
    vm.prank(address(governor));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
    bytes32 wormholeAddress = hubVotePool.spokeRegistry(_wormholeChainId);
    assertEq(wormholeAddress, spokeWormholeAddress);
  }

  function testFuzz_CorrectlyEmitsSpokeRegisteredEvent(uint16 _wormholeChainId, address _spokeContract) public {
    bytes32 spokeWormholeAddress = bytes32(uint256(uint160(_spokeContract)));
    vm.expectEmit();
    emit HubVotePool.SpokeRegistered(
      _wormholeChainId, hubVotePool.spokeRegistry(_wormholeChainId), spokeWormholeAddress
    );
    vm.prank(address(governor));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
  }

  function testFuzz_RevertIf_NotCalledByOwner(uint16 _wormholeChainId, address _spokeContract, address _caller) public {
    vm.assume(_caller != address(governor));
    bytes32 spokeWormholeAddress = bytes32(uint256(uint160(_spokeContract)));
    vm.prank(_caller);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
    hubVotePool.registerSpoke(_wormholeChainId, spokeWormholeAddress);
  }
}

contract CrossChainEVMVote is HubVotePoolTest {
  function testFuzz_CorrectlyAddNewVote(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes
  ) public {
    vm.assume(_againstVotes != 0);
    vm.assume(_proposalId != 0);

    vm.prank(address(governor));
    hubVotePool.registerSpoke(2, bytes32(uint256(uint160(GOVERNANCE_CONTRACT))));

    bytes memory _resp = _buildAddVoteQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      QUERY_CHAIN_ID,
      GOVERNANCE_CONTRACT
    );

    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    hubVotePool.crossChainEVMVote(_resp, signatures);

    (uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
      hubVotePool.spokeProposalVotes(keccak256(abi.encode(2, _proposalId)));

    assertEq(governor.proposalId(), _proposalId);
    assertEq(governor.support(), 1);
    assertEq(governor.reason(), "rolled-up vote from governance spoke token holders");
    assertEq(governor.params(), abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes)));
    assertEq(againstVotes, _againstVotes);
    assertEq(forVotes, _forVotes);
    assertEq(abstainVotes, _abstainVotes);
  }

  function testFuzz_RevertIf_QueriedVotesAreLessThanOnHubVotePoolForSpoke(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes
  ) public {
    vm.assume(_againstVotes != 0);
    vm.assume(_proposalId != 0);

    vm.prank(address(governor));
    hubVotePool.registerSpoke(2, bytes32(uint256(uint160(GOVERNANCE_CONTRACT))));

    bytes memory _resp = _buildAddVoteQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      QUERY_CHAIN_ID,
      GOVERNANCE_CONTRACT
    );

    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    hubVotePool.crossChainEVMVote(_resp, signatures);
    bytes memory _invalidResp = _buildAddVoteQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes - 1,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      QUERY_CHAIN_ID,
      GOVERNANCE_CONTRACT
    );
    (uint8 invalidSigV, bytes32 invalidSigR, bytes32 invalidSigS) = getSignature(_invalidResp, address(hubVotePool));
    signatures[0] = IWormhole.Signature({r: invalidSigR, s: invalidSigS, v: invalidSigV, guardianIndex: 0});

    vm.expectRevert(HubVotePool.InvalidProposalVote.selector);
    hubVotePool.crossChainEVMVote(_invalidResp, signatures);
  }

  function testFuzz_RevertIf_SpokeIsNotRegistered(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes
  ) public {
    bytes memory _resp = _buildAddVoteQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      QUERY_CHAIN_ID,
      GOVERNANCE_CONTRACT
    );

    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

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
    hubVotePool.registerSpoke(2, bytes32(uint256(uint160(GOVERNANCE_CONTRACT))));
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
        QueryTest.buildPerChainResponseBytes(
          2, // eth mainnet
          hubVotePool.QT_ETH_CALL(),
          ethCallResp
        ),
        QueryTest.buildPerChainResponseBytes(
          2, // eth mainnet
          hubVotePool.QT_ETH_CALL(),
          ethCallResp
        )
      )
    );
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(abi.encodeWithSelector(HubVotePool.TooManyQueryResponses.selector, 2));
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }

  function test_RevertIf_TooManyCalls() public {
    vm.prank(address(governor));
    hubVotePool.registerSpoke(2, bytes32(uint256(uint160(GOVERNANCE_CONTRACT))));
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      2, // numCallData
      abi.encodePacked(
        QueryTest.buildEthCallDataBytes(
          GOVERNANCE_CONTRACT, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", 1, 2, 3)
        ),
        QueryTest.buildEthCallDataBytes(GOVERNANCE_CONTRACT, abi.encodeWithSignature("proposalVotes(uint256)", 1))
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        2, // chainId: (Ethereum mainnet)
        hubVotePool.QT_ETH_CALL(),
        ethCall
      )
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
      QueryTest.buildPerChainResponseBytes(
        2, // eth mainnet
        hubVotePool.QT_ETH_CALL(),
        ethCallResp
      )
    );
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(abi.encodeWithSelector(HubVotePool.TooManyEthCallResults.selector, 2));
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }
}
