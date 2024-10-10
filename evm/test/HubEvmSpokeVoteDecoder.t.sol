// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";
import {
  ParsedPerChainQueryResponse, ParsedQueryResponse, InvalidContractAddress
} from "wormhole-sdk/QueryResponse.sol";
import {toWormholeFormat} from "wormhole-sdk/Utils.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {HubEvmSpokeVoteDecoder} from "src/HubEvmSpokeVoteDecoder.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {HubVotePoolHarness} from "test/harnesses/HubVotePoolHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";

contract HubEvmSpokeVoteDecoderTest is WormholeEthQueryTest, AddressUtils {
  GovernorMock governor;
  HubEvmSpokeVoteDecoder hubCrossChainEvmVote;
  HubVotePoolHarness hubVotePool;
  address timelock;

  struct VoteParams {
    uint256 proposalId;
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  function setUp() public {
    _setupWormhole();
    governor = new GovernorMock();
    timelock = makeAddr("Timelock");
    hubVotePool = new HubVotePoolHarness(address(wormhole), address(governor), timelock);
    hubCrossChainEvmVote = new HubEvmSpokeVoteDecoder(address(wormhole), address(hubVotePool));
  }

  function _buildParsedPerChainResponse(VoteParams memory _voteParams, uint16 _responseChainId, address _governance)
    internal
    view
    returns (ParsedPerChainQueryResponse memory)
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

contract Constructor is HubEvmSpokeVoteDecoderTest {
  function testFuzz_CorrectlySetConstructorArgs(address _core, address _hubVotePool) public {
    vm.assume(_core != address(0));
    HubEvmSpokeVoteDecoder vote = new HubEvmSpokeVoteDecoder(_core, _hubVotePool);
    assertEq(address(vote.wormhole()), _core);
    assertEq(address(vote.HUB_VOTE_POOL()), _hubVotePool);
  }
}

contract Decode is HubEvmSpokeVoteDecoderTest {
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

    vm.prank(timelock);
    hubVotePool.registerSpoke(_queryChainId, addressToBytes32(_spokeContract));

    ISpokeVoteDecoder.QueryVote memory queryVote = hubCrossChainEvmVote.decode(_resp, IGovernor(address(governor)));
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

    vm.expectRevert(InvalidContractAddress.selector);
    hubCrossChainEvmVote.decode(_resp, IGovernor(address(governor)));
  }

  function testFuzz_RevertIf_QueryBlockIsNotFinalized(
    uint256 _proposalId,
    uint64 _abstainVotes,
    string memory blockId,
    bytes32 _finality
  ) public {
    vm.assume(_finality != bytes9("finalized"));
    vm.prank(address(timelock));
    hubVotePool.registerSpoke(MAINNET_CHAIN_ID, toWormholeFormat(GOVERNANCE_CONTRACT));
    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes(blockId), // random blockId: a hash of the block number
      abi.encodePacked(bytes9(_finality)), // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        GOVERNANCE_CONTRACT, abi.encodeWithSignature("proposalVotes(uint256)", _proposalId)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        uint16(MAINNET_CHAIN_ID), // chainId: (Ethereum mainnet)
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
          _proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_abstainVotes),
            forVotes: uint128(_abstainVotes),
            abstainVotes: uint128(_abstainVotes)
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
        uint16(MAINNET_CHAIN_ID), hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp
      )
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);
    ParsedQueryResponse memory parsedResp = hubCrossChainEvmVote.parseAndVerifyQueryResponse(_resp, signatures);
    vm.expectRevert(abi.encodeWithSelector(ISpokeVoteDecoder.InvalidQueryBlock.selector, bytes(blockId)));
    hubCrossChainEvmVote.decode(parsedResp.responses[0], IGovernor(address(governor)));
  }

  //
  function testFuzz_RevertIf_FinalityLengthIsTooLong(
    uint256 _proposalId,
    uint64 _abstainVotes,
    string memory blockId,
    bytes32 _finality
  ) public {
    vm.assume(_finality.length != 9);
    vm.prank(address(timelock));
    hubVotePool.registerSpoke(MAINNET_CHAIN_ID, toWormholeFormat(GOVERNANCE_CONTRACT));
    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes(blockId), // random blockId: a hash of the block number
      abi.encodePacked(_finality), // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        GOVERNANCE_CONTRACT, abi.encodeWithSignature("proposalVotes(uint256)", _proposalId)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        uint16(MAINNET_CHAIN_ID), // chainId: (Ethereum mainnet)
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
          _proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_abstainVotes),
            forVotes: uint128(_abstainVotes),
            abstainVotes: uint128(_abstainVotes)
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
        uint16(MAINNET_CHAIN_ID), hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp
      )
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);
    ParsedQueryResponse memory parsedResp = hubCrossChainEvmVote.parseAndVerifyQueryResponse(_resp, signatures);
    vm.expectRevert(abi.encodeWithSelector(BytesParsing.LengthMismatch.selector, _finality.length, 9));
    hubCrossChainEvmVote.decode(parsedResp.responses[0], IGovernor(address(governor)));
  }
}

contract SupportsInterface is HubEvmSpokeVoteDecoderTest {
  function test_Erc165InterfaceIsSupported() public view {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(IERC165).interfaceId);
    assertTrue(isValid);
  }

  function test_CrossChainVoteInterfaceSupported() public view {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(ISpokeVoteDecoder).interfaceId);
    assertTrue(isValid);
  }

  function test_InterfaceIsNotSupported() public view {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(IWormhole).interfaceId);
    assertFalse(isValid);
  }
}
