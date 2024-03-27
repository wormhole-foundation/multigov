// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";

import {HubVotePool} from "src/HubVotePool.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {QueryResponse} from "wormhole/query/QueryResponse.sol";
import {GovernorVoteFake} from "test/fakes/GovernorVoteFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

import {ERC20Votes} from "@openzeppelin-contracts/token/ERC20/extensions/ERC20Votes.sol";
import {TimelockController} from "@openzeppelin-contracts/governance/TimelockController.sol";
import {SpokeMetadataCollectorQueriesHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";

contract HubVotePoolTest is WormholeEthQueryTest {
  HubVotePool hubVotePool;
  GovernorMock governor;

  struct VoteParams {
    uint256 proposalId;
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  function setUp() public {
    _setupWormhole();
    // TimelockControllerFake timelock = new TimelockControllerFake(address(0));
    // ERC20VotesFake token = new ERC20VotesFake();
    governor = new GovernorMock();
    // Stopped here TODO Governor needs to be governor to cast vote
    hubVotePool = new HubVotePool(address(wormhole), address(governor));
  }

  function _buildAddVoteQuery(VoteParams memory _voteParams, uint16 _responseChainId, address _governance)
    internal
    view
    returns (bytes memory)
  {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
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
          SpokeVoteAggregator.ProposalVote({
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
      OFF_CHAIN_SIGNATURE, // signature // TODO: figure this out
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

  // hubvote pool test
  // 5. sucessfully cast vote
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
      uint16(2),
      GOVERNANCE_CONTRACT
    );

    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    // sigGuardian index is currently 0
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    hubVotePool.crossChainEVMVote(_resp, signatures);

    assertEq(governor.proposalId(), _proposalId);
    assertEq(governor.support(), 1);
    assertEq(governor.reason(), "rolled-up vote from governance L2 token holders");
    assertEq(governor.params(), abi.encodePacked(uint128(_againstVotes), uint128(_forVotes), uint128(_abstainVotes)));
  }

  // 4 Invalid vote
  function testFuzz_RevertIf_InvalidProposalVoteQuery(
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
      uint16(2),
      GOVERNANCE_CONTRACT
    );

    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    // sigGuardian index is currently 0
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    hubVotePool.crossChainEVMVote(_resp, signatures);
    bytes memory _invalidResp = _buildAddVoteQuery(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes - 1,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      uint16(2),
      GOVERNANCE_CONTRACT
    );
    (uint8 invalidSigV, bytes32 invalidSigR, bytes32 invalidSigS) = getSignature(_invalidResp, address(hubVotePool));
    // sigGuardian index is currently 0
    signatures[0] = IWormhole.Signature({r: invalidSigR, s: invalidSigS, v: invalidSigV, guardianIndex: 0});

    vm.expectRevert(HubVotePool.InvalidProposalVote.selector);
    hubVotePool.crossChainEVMVote(_invalidResp, signatures);
  }

  // 2. unknown message emitter
  function testFuzz_RevertIf_UnknownMessageEmitter(
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
      uint16(2),
      GOVERNANCE_CONTRACT
    );

    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    // sigGuardian index is currently 0
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(HubVotePool.UnknownMessageEmitter.selector);
    hubVotePool.crossChainEVMVote(_resp, signatures);
  }

  // 1. too many responses
  // 3. Too many results
}
