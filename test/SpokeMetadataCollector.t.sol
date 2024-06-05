// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {console2, Test} from "forge-std/Test.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeMetadataCollectorHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";

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
}

contract AddProposal is WormholeEthQueryTest {
  function setUp() public {
    _setupWormhole();
    spokeMetadataCollector =
      new SpokeMetadataCollectorHarness(address(wormhole), uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
  }

  function _buildAddProposalQuery(
    uint256 _proposalId,
    uint256 _voteStart,
    uint256 _voteEnd,
    uint16 _responseChainId,
    address _governance
  ) internal view returns (bytes memory) {
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _governance,
        abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", _proposalId, _voteStart, _voteEnd)
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
      QueryTest.buildEthCallResultBytes(abi.encode(_proposalId, _voteStart, _voteEnd)) // results
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

  function testFuzz_SuccessfullyAddProposal(uint256 _proposalId, uint256 _voteStart, uint256 _voteEnd) public {
    vm.assume(_proposalId != 0);
    vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);
    _voteEnd = bound(_voteEnd, _voteStart + 1, type(uint256).max);

    bytes memory _resp =
      _buildAddProposalQuery(_proposalId, _voteStart, _voteEnd, uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    spokeMetadataCollector.addProposal(_resp, signatures);
    SpokeMetadataCollector.Proposal memory proposal = spokeMetadataCollector.exposed_proposals(_proposalId);

    assertEq(proposal.voteStart, _voteStart);
  }

  function testFuzz_RevertIf_SenderChainIsNotTheHubChain(
    uint256 _proposalId,
    uint256 _voteStart,
    uint256 _voteEnd,
    uint16 _responseChainId
  ) public {
    vm.assume(_proposalId != 0);
    vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);
    vm.assume(_responseChainId != uint16(MAINNET_CHAIN_ID));
    _voteEnd = bound(_voteEnd, _voteStart + 1, type(uint256).max);

    bytes memory _resp =
      _buildAddProposalQuery(_proposalId, _voteStart, _voteEnd, _responseChainId, GOVERNANCE_CONTRACT);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(SpokeMetadataCollector.SenderChainMismatch.selector);
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function testFuzz_RevertIf_ContractIsNotHubProposalMetadata(
    uint256 _proposalId,
    uint256 _voteStart,
    uint256 _voteEnd,
    address _callingAddress
  ) public {
    vm.assume(_proposalId != 0);
    vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);
    vm.assume(_callingAddress != GOVERNANCE_CONTRACT);
    _voteEnd = bound(_voteEnd, _voteStart + 1, type(uint256).max);

    bytes memory _resp =
      _buildAddProposalQuery(_proposalId, _voteStart, _voteEnd, uint16(MAINNET_CHAIN_ID), _callingAddress);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(
      abi.encodeWithSelector(
        SpokeMetadataCollector.InvalidWormholeMessage.selector,
        bytes("Query data must be from hub proposal metadata contract")
      )
    );
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function testFuzz_RevertIf_ProposalAlreadyExists(uint256 _proposalId, uint256 _voteStart, uint256 _voteEnd) public {
    vm.assume(_proposalId != 0);
    vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);
    _voteEnd = bound(_voteEnd, _voteStart + 1, type(uint256).max);

    bytes memory _resp =
      _buildAddProposalQuery(_proposalId, _voteStart, _voteEnd, uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(spokeMetadataCollector));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(abi.encodeWithSelector(SpokeMetadataCollector.TooManyEthCallResults.selector, 2));
    spokeMetadataCollector.addProposal(_resp, signatures);
  }
}
