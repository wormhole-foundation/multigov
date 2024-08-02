// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Test} from "forge-std/Test.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {ParsedPerChainQueryResponse, ParsedQueryResponse} from "wormhole/query/QueryResponse.sol";
import {HubCrossChainEvmCallVoteDecoder} from "src/HubCrossChainEvmCallVoteDecoder.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ICrossChainVoteDecoder} from "src/interfaces/ICrossChainVoteDecoder.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {HubVotePoolHarness} from "test/harnesses/HubVotePoolHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";

contract HubCrossChainEvmCallVoteDecoderTest is WormholeEthQueryTest, AddressUtils {
  GovernorMock governor;
  HubCrossChainEvmCallVoteDecoder hubCrossChainEvmVote;
  HubVotePoolHarness hubVotePool;

  struct VoteParams {
    uint256 proposalId;
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  function setUp() public {
    _setupWormhole();
    governor = new GovernorMock();
    hubVotePool = new HubVotePoolHarness(address(wormhole), address(governor), new HubVotePool.SpokeVoteAggregator[](0));
    hubCrossChainEvmVote = new HubCrossChainEvmCallVoteDecoder(address(wormhole), address(hubVotePool));
  }

  function _buildParsedPerChainResponse(VoteParams memory _voteParams, uint16 _responseChainId, address _governance)
    internal
    view
    returns (ParsedPerChainQueryResponse memory)
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

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);
    ParsedQueryResponse memory parsedResp = hubCrossChainEvmVote.parseAndVerifyQueryResponse(_resp, signatures);
    return parsedResp.responses[0];
  }

  function _getSignatures(bytes memory _resp) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }
}

contract Constructor is HubCrossChainEvmCallVoteDecoderTest {
  function testFuzz_CorrectlySetConstructorArgs(address _core, address _hubVotePool) public {
    vm.assume(_core != address(0));
    HubCrossChainEvmCallVoteDecoder vote = new HubCrossChainEvmCallVoteDecoder(_core, _hubVotePool);
    assertEq(address(vote.wormhole()), _core);
    assertEq(address(vote.HUB_VOTE_POOL()), _hubVotePool);
  }
}

contract Decode is HubCrossChainEvmCallVoteDecoderTest {
  function testFuzz_CorrectlyParseChainResponse(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    vm.assume(_spokeContract != address(0));
    ParsedPerChainQueryResponse memory _resp = _buildParsedPerChainResponse(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      _queryChainId,
      _spokeContract
    );

    vm.prank(address(governor));
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    ICrossChainVoteDecoder.QueryVote memory queryVote = hubCrossChainEvmVote.decode(_resp);
    assertEq(queryVote.proposalId, _proposalId);
    assertEq(queryVote.spokeProposalId, keccak256(abi.encode(_queryChainId, _proposalId)));
    assertEq(queryVote.proposalVote.abstainVotes, _abstainVotes);
    assertEq(queryVote.proposalVote.againstVotes, _againstVotes);
    assertEq(queryVote.proposalVote.forVotes, _forVotes);
    assertEq(queryVote.chainId, _queryChainId);
  }

  function testFuzz_RevertIf_SpokeIsNotRegistered(
    uint256 _proposalId,
    uint64 _againstVotes,
    uint64 _forVotes,
    uint64 _abstainVotes,
    address _spokeContract,
    uint16 _queryChainId
  ) public {
    ParsedPerChainQueryResponse memory _resp = _buildParsedPerChainResponse(
      VoteParams({
        proposalId: _proposalId,
        againstVotes: _againstVotes,
        forVotes: _forVotes,
        abstainVotes: _abstainVotes
      }),
      _queryChainId,
      _spokeContract
    );

    vm.expectRevert(ICrossChainVoteDecoder.UnknownMessageEmitter.selector);
    hubCrossChainEvmVote.decode(_resp);
  }
}

contract SupportsInterface is HubCrossChainEvmCallVoteDecoderTest {
  function test_Erc165InterfaceIsSupported() public {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(IERC165).interfaceId);
    assertTrue(isValid);
  }

  function test_CrossChainVoteInterfaceSupported() public {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(ICrossChainVoteDecoder).interfaceId);
    assertTrue(isValid);
  }

  function test_InterfaceIsNotSupported() public {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(IWormhole).interfaceId);
    assertFalse(isValid);
  }
}
