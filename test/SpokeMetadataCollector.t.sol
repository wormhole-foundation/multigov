// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {Setup} from "wormhole/Setup.sol";
import {Implementation} from "wormhole/Implementation.sol";
import {Wormhole} from "wormhole/Wormhole.sol";

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeMetadataCollectorQueriesHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";

contract SpokeMetadataCollectorQueriesTest is Test {
  address constant DEVNET_GUARDIAN = 0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe;
  uint256 constant DEVNET_GUARDIAN_PRIVATE_KEY = 0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0;
  uint256 constant MAINNET_CHAIN_ID = 2;
  uint8 constant VERSION = 1;
  uint8 constant OFF_CHAIN_SENDER = 0;
  bytes constant OFF_CHAIN_SIGNATURE =
    hex"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  address GOVERNANCE_CONTRACT = makeAddr("governance");
  Wormhole public wormhole;
  SpokeMetadataCollectorQueriesHarness spokeMetadataCollector;

  function setUp() public {
    _setupWormhole();
    spokeMetadataCollector =
      new SpokeMetadataCollectorQueriesHarness(address(wormhole), uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
  }

  function _setupWormhole() internal {
    // Deploy the Setup contract.
    Setup setup = new Setup();

    // Deploy the Implementation contract.
    Implementation implementation = new Implementation();

    address[] memory guardians = new address[](1);
    guardians[0] = DEVNET_GUARDIAN;

    // Deploy the Wormhole contract.
    wormhole = new Wormhole(
      address(setup),
      abi.encodeWithSelector(
        bytes4(keccak256("setup(address,address[],uint16,uint16,bytes32,uint256)")),
        address(implementation),
        guardians,
        MAINNET_CHAIN_ID,
        MAINNET_CHAIN_ID,
        GOVERNANCE_CONTRACT,
        block.chainid // evm chain id
      )
    );
  }

  function getSignature(bytes memory response) internal view returns (uint8 v, bytes32 r, bytes32 s) {
    bytes32 responseDigest = spokeMetadataCollector.getResponseDigest(response);
    (v, r, s) = vm.sign(DEVNET_GUARDIAN_PRIVATE_KEY, responseDigest);
  }
}

contract AddProposal is SpokeMetadataCollectorQueriesTest {
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
      OFF_CHAIN_SIGNATURE, // signature // TODO: figure this out
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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    spokeMetadataCollector.addProposal(_resp, signatures);
    SpokeMetadataCollector.Proposal memory proposal = spokeMetadataCollector.exposed_proposals(_proposalId);

    assertEq(proposal.voteStart, _voteStart);
    assertEq(proposal.voteEnd, _voteEnd);
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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(
      abi.encodeWithSelector(SpokeMetadataCollector.InvalidWormholeMessage.selector, bytes("Query data must be from hub proposal metadata contract"))
    );
    spokeMetadataCollector.addProposal(_resp, signatures);
  }

  function testFuzz_RevertIf_ProposalAlreadyExists(uint256 _proposalId, uint256 _voteStart, uint256 _voteEnd) public {
    vm.assume(_proposalId != 0);
    vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);
    _voteEnd = bound(_voteEnd, _voteStart + 1, type(uint256).max);

    bytes memory _resp =
      _buildAddProposalQuery(_proposalId, _voteStart, _voteEnd, uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
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
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});

    vm.expectRevert(abi.encodeWithSelector(SpokeMetadataCollector.TooManyEthCallResults.selector, 2));
    spokeMetadataCollector.addProposal(_resp, signatures);
  }
}
