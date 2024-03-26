// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {Setup} from "wormhole/Setup.sol";
import {Implementation} from "wormhole/Implementation.sol";
import {Wormhole} from "wormhole/Wormhole.sol";

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollectorQueries.sol";

contract SpokeMetadataCollectorQueriesTest is Test {
  address constant DEVNET_GUARDIAN = 0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe;
  uint256 constant DEVNET_GUARDIAN_PRIVATE_KEY = 0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0;
  uint256 constant MAINNET_CHAIN_ID = 2;
  uint8 constant VERSION = 1;
  uint8 constant OFF_CHAIN_SENDER = 0;
  bytes constant OFF_CHAIN_SIGNATURE =
    hex"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  uint256 constant GOVERNANCE_CHAIN_ID = 2;
  bytes signature =
    hex"ff0c222dc9e3655ec38e212e9792bf1860356d1277462b6bf747db865caca6fc08e6317b64ee3245264e371146b1d315d38c867fe1f69614368dc4430bb560f200";
  address GOVERNANCE_CONTRACT = 0x8a907De47E00830a2b742db65e938a3ea1070A2E; // Pooltogether governor
  Wormhole public wormhole;
  SpokeMetadataCollector spokeMetadataCollector;

  function setUp() public {
    _setupWormhole();
    spokeMetadataCollector =
      new SpokeMetadataCollector(address(wormhole), uint16(MAINNET_CHAIN_ID), GOVERNANCE_CONTRACT);
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
        GOVERNANCE_CHAIN_ID,
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
  // TODO; Add rpc fork
  function test_addsProposal(uint256 _proposalId, uint256 _voteStart, uint256 _voteEnd) public {
    vm.assume(_proposalId != 0);
	vm.assume(_voteStart != 0 && _voteStart != type(uint256).max);
    _voteEnd = bound(_voteEnd, _voteStart + 1, type(uint256).max);
    console2.log(block.number);
    vm.roll(19_491_891);
    bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
      bytes("0x1296c33"), // blockId
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        GOVERNANCE_CONTRACT, abi.encodeWithSignature("getProposalMetadata(uint256,uint256,uint256)", _proposalId, _voteStart, _voteEnd)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        2, // chainId: (Ethereum mainnet)
        1, // spokeMetahataCollector.QT_ETH_CALL()
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
        uint16(MAINNET_CHAIN_ID), // eth mainnet
        1, //spokeMetadataCollector.QT_ETH_CALL(),
        ethCallResp
      )
    );

    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    // sigGuardian index is currently 0
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    spokeMetadataCollector.addProposal(_resp, signatures);
  }
}
