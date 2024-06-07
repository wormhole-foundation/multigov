// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {console2, Test} from "forge-std/Test.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeMetadataCollectorHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {EmptyWormholeAddress} from "wormhole/query/QueryResponse.sol";

contract SpokeMetadataCollectorTest is WormholeEthQueryTest {
  function setUp() public {
    _setupWormhole();
    spokeMetadataCollector =
      new SpokeMetadataCollectorHarness(address(wormhole), uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
  }

  function _buildAddProposalQuery(uint256 _proposalId, uint256 _voteStart, uint16 _responseChainId, address _governance)
    internal
    view
    returns (bytes memory)
  {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _governance, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", _proposalId, _voteStart)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        _responseChainId, // chainId: (Ethereum mainnet)
        spokeMetadataCollector.QT_ETH_CALL(),
        ethCall
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(abi.encode(_proposalId, _voteStart)) // results
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
        spokeMetadataCollector.QT_ETH_CALL(),
        ethCallResp
      )
    );
    return _resp;
  }

  function _addProposal(uint256 _proposalId, uint256 _voteStart) internal {
    bytes memory _resp = _buildAddProposalQuery(_proposalId, _voteStart, uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function _getProposalSignatures(bytes memory _resp) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }
}

contract Constructor is Test {
  function testFuzz_CorrectlySetContstructorArgs(address _core, uint16 _hubChainId, address _hubProposalMetadata)
    public
  {
    vm.assume(_core != address(0));

    SpokeMetadataCollector spokeMetadataCollector = new SpokeMetadataCollector(_core, _hubChainId, _hubProposalMetadata);
    assertEq(address(spokeMetadataCollector.WORMHOLE_CORE()), _core);
    assertEq(spokeMetadataCollector.HUB_CHAIN_ID(), _hubChainId);
    assertEq(spokeMetadataCollector.HUB_PROPOSAL_METADATA(), _hubProposalMetadata);
  }

  function testFuzz_RevertIf_CoreIsZero(address _hubProposalMetadata, uint16 _hubChainId) public {
    vm.expectRevert(EmptyWormholeAddress.selector);
    new SpokeMetadataCollector(address(0), _hubChainId, _hubProposalMetadata);
  }
}

contract GetProposal is SpokeMetadataCollectorTest {
  function testFuzz_SuccessfullyGetProposal(uint256 _proposalId, uint256 _voteStart) public {
    _addProposal(_proposalId, _voteStart);

    SpokeMetadataCollector.Proposal memory proposal = spokeMetadataCollector.getProposal(_proposalId);
    assertEq(proposal.voteStart, _voteStart);
  }
}

contract AddProposal is SpokeMetadataCollectorTest {
  function testFuzz_SuccessfullyAddProposal(uint256 _proposalId, uint256 _voteStart) public {
    _addProposal(_proposalId, _voteStart);
    SpokeMetadataCollector.Proposal memory proposal = spokeMetadataCollector.exposed_proposals(_proposalId);

    assertEq(proposal.voteStart, _voteStart);
  }

  function testFuzz_SuccessfullyAddMultipleProposals(
    uint256 _proposalId1,
    uint256 _proposalId2,
    uint256 _voteStart1,
    uint256 _voteStart2
  ) public {
    vm.assume(_proposalId1 != _proposalId2);

    _addProposal(_proposalId1, _voteStart1);
    _addProposal(_proposalId2, _voteStart2);

    SpokeMetadataCollector.Proposal memory proposal1 = spokeMetadataCollector.exposed_proposals(_proposalId1);
    SpokeMetadataCollector.Proposal memory proposal2 = spokeMetadataCollector.exposed_proposals(_proposalId2);

    assertEq(proposal1.voteStart, _voteStart1);
    assertEq(proposal2.voteStart, _voteStart2);
  }

  function testFuzz_EmitsProposalCreated(uint256 _proposalId, uint256 _voteStart) public {
    vm.expectEmit();
    emit SpokeMetadataCollector.ProposalCreated(_proposalId, _voteStart);
    _addProposal(_proposalId, _voteStart);
  }

  function testFuzz_RevertIf_SenderChainIsNotTheHubChain(
    uint256 _proposalId,
    uint256 _voteStart,
    uint16 _responseChainId
  ) public {
    vm.assume(_responseChainId != uint16(MAINNET_CHAIN_ID));

    bytes memory _resp = _buildAddProposalQuery(_proposalId, _voteStart, _responseChainId, GOVERNANCE_CONTRACT);
    IWormhole.Signature[] memory signatures = _getProposalSignatures(_resp);

    vm.expectRevert(SpokeMetadataCollector.SenderChainMismatch.selector);
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function testFuzz_RevertIf_ContractIsNotHubProposalMetadata(
    uint256 _proposalId,
    uint256 _voteStart,
    address _callingAddress
  ) public {
    vm.assume(_callingAddress != GOVERNANCE_CONTRACT);

    bytes memory _resp = _buildAddProposalQuery(_proposalId, _voteStart, uint16(MAINNET_CHAIN_ID), _callingAddress);
    IWormhole.Signature[] memory signatures = _getProposalSignatures(_resp);

    vm.expectRevert(
      abi.encodeWithSelector(
        SpokeMetadataCollector.InvalidWormholeMessage.selector,
        bytes("Query data must be from hub proposal metadata contract")
      )
    );
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function testFuzz_RevertIf_ProposalAlreadyExists(uint256 _proposalId, uint256 _voteStart) public {
    vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);

    bytes memory _resp = _buildAddProposalQuery(_proposalId, _voteStart, uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
    IWormhole.Signature[] memory signatures = _getProposalSignatures(_resp);

    spokeMetadataCollector.addProposal(_resp, signatures);

    vm.expectRevert(SpokeMetadataCollector.ProposalAlreadyExists.selector);
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function test_RevertIf_TooManyResponsesPassedInResponseBytes() public {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        GOVERNANCE_CONTRACT, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", 1, 2, 3)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      2, // num per chain requests
      abi.encodePacked(
        QueryTest.buildPerChainRequestBytes(
          2, // chainId: (Ethereum mainnet)
          spokeMetadataCollector.QT_ETH_CALL(),
          ethCall
        ),
        QueryTest.buildPerChainRequestBytes(
          2, // chainId: (Ethereum mainnet)
          spokeMetadataCollector.QT_ETH_CALL(),
          ethCall
        )
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(abi.encode(1, 2, 3)) // results
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
          spokeMetadataCollector.QT_ETH_CALL(),
          ethCallResp
        ),
        QueryTest.buildPerChainResponseBytes(
          2, // eth mainnet
          spokeMetadataCollector.QT_ETH_CALL(),
          ethCallResp
        )
      )
    );
    IWormhole.Signature[] memory signatures = _getProposalSignatures(_resp);

    vm.expectRevert(abi.encodeWithSelector(SpokeMetadataCollector.TooManyQueryResponses.selector, 2));
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function test_RevertIf_TooManyCalls() public {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      2, // numCallData
      abi.encodePacked(
        QueryTest.buildEthCallDataBytes(
          GOVERNANCE_CONTRACT, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", 1, 2, 3)
        ),
        QueryTest.buildEthCallDataBytes(
          GOVERNANCE_CONTRACT, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", 1, 2, 3)
        )
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        2, // chainId: (Ethereum mainnet)
        spokeMetadataCollector.QT_ETH_CALL(),
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
        spokeMetadataCollector.QT_ETH_CALL(),
        ethCallResp
      )
    );
    IWormhole.Signature[] memory signatures = _getProposalSignatures(_resp);

    vm.expectRevert(abi.encodeWithSelector(SpokeMetadataCollector.TooManyEthCallResults.selector, 2));
    spokeMetadataCollector.addProposal(_resp, signatures);
  }
}
