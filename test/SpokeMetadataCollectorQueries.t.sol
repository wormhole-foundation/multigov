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
  uint256 constant TEST_CHAIN_ID = 2;
  uint256 constant GOVERNANCE_CHAIN_ID = 2;
  bytes signature =
    hex"ff0c222dc9e3655ec38e212e9792bf1860356d1277462b6bf747db865caca6fc08e6317b64ee3245264e371146b1d315d38c867fe1f69614368dc4430bb560f200";
  address GOVERNANCE_CONTRACT = 0x8a907De47E00830a2b742db65e938a3ea1070A2E;// Pooltogether governor
  Wormhole public wormhole;
  SpokeMetadataCollector spokeMetadataCollector;

  function setUp() public {
    _setupWormhole();
    spokeMetadataCollector = new SpokeMetadataCollector(address(wormhole), uint16(TEST_CHAIN_ID), GOVERNANCE_CONTRACT);
  }

  function _buildProposalQueryResponse() internal {}

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
        TEST_CHAIN_ID,
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
  function test_addsProposal() public {
    console2.log(block.number);
	vm.roll(19491891);
    // version and nonce are arbitrary
    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      1, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        2, // chainId: (Ethereum mainnet)
        1, // spokeMetahataCollector.QT_ETH_CALL()
        QueryTest.buildEthCallRequestBytes(
          bytes("0x1296c33"), // blockId
          1, // numCallData
          QueryTest.buildEthCallDataBytes(
            GOVERNANCE_CONTRACT, abi.encodeWithSignature("proposalSnapshot(uint256)", 24839816214828384263539327369154487854484578239469725710863202804626869490979)
          )
        )
      )
    );
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      1, // version
      0, // sender chain id
      hex"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", // signature // TODO: figure this out
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(
        2, // eth mainnet 
        1, //spokeMetadataCollector.QT_ETH_CALL(),
        QueryTest.buildEthCallResponseBytes(
          uint64(block.number), // block number
          blockhash(block.number), // block hash
          uint64(block.timestamp), // block time US
          1, // numResults
          QueryTest.buildEthCallResultBytes(abi.encode(19093581)) // results
        )
      )
    );
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp);
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    // sigGuardian index is currently 0
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    spokeMetadataCollector.addProposal(_resp, signatures);
  }
  function test_recreateSDKExample() public {
    // build signature
    uint256 signerPrivKey = 0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0;
    address mockSigner = vm.addr(signerPrivKey);

    // per chain response, call query response
    bytes memory resp = QueryTest.buildPerChainResponseBytes(
      2, // etheruem
      spokeMetadataCollector.QT_ETH_CALL(),
      QueryTest.buildEthCallResponseBytes(
        19_491_891, // block number
        0x8ec91127ee4bdba0dd64fc9e6fdee0dc78a5deeeddf778e272418edd189abfa3, // block hash
        1_711_131_395_000_000, // block time US
        1, // numResults
        QueryTest.buildEthCallResultBytes(abi.encode(2_972_523_950_058_045_656_904_313)) // results
      )
    );
    bytes memory perChainReq = QueryTest.buildPerChainRequestBytes(
      2, // ethereum chain id
      1,
      QueryTest.buildEthCallRequestBytes(
        bytes("0x1296c33"), // hex rep of the block number
		//bytes(vm.toString(abi.encodePacked(uint32(19491891)))),
        1,
        QueryTest.buildEthCallDataBytes(
          0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, abi.encodeWithSignature("totalSupply()")
        )
      )
    );

    bytes memory queryRequest = QueryTest.buildOffChainQueryRequestBytes(1, 0, 1, perChainReq);

    bytes memory finalResp = QueryTest.buildQueryResponseBytes(
      1, // version
      0, // off chain query,
      hex"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", // off
        // chain query
      queryRequest,
      1,
      resp
    );

    // 0100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000370100000000010002010000002a0000000930783132393663333301c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000418160ddd01000201000000550000000001296c338ec91127ee4bdba0dd64fc9e6fdee0dc78a5deeeddf778e272418edd189abfa300061443d2f686c00100000020000000000000000000000000000000000000000000027574d8a1eeedca2db279'
    // bytes memory finalResp =
    // hex"0100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000370100000000010002010000002a0000000930783132393663333301c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000418160ddd01000201000000550000000001296c338ec91127ee4bdba0dd64fc9e6fdee0dc78a5deeeddf778e272418edd189abfa300061443d2f686c00100000020000000000000000000000000000000000000000000027574d8a1eeedca2db279";
    console2.logBytes32(keccak256(finalResp));
    console2.logBytes(finalResp);
    console2.logUint(queryRequest.length);
    console2.logBytes(queryRequest);
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(
      signerPrivKey, keccak256(abi.encodePacked(bytes("query_response_0000000000000000000|"), keccak256(finalResp)))
    );
    bytes memory signature = abi.encodePacked(r, s, v);
    console2.logUint(v);
    console2.logBytes32(s);
    console2.logBytes32(r);
    console2.logString("Signature");
    console2.logBytes(signature); // close the v is off for some reaso, the data is correct
    console2.logString(vm.toString(uint256(19491891))); // close the v is off for some reaso, the data is correct
    // console2.logString(vm.toString(19491891)); // close the v is off for some reaso, the data is correct
    //0f5854d87f612721a9026b476e7b624db4d8776a4fa35730c83e6b9d5a695c27188fd2be00960855d22b19ee3bc8d6361ced6d12529e8dd7f9fd0be527e4a94f0000

    // 0x0100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000370100000000010002010000002a00000009000000000001296c3301c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000418160ddd01000201000000550000000001296c338ec91127ee4bdba0dd64fc9e6fdee0dc78a5deeeddf778e272418edd189abfa300061443d2f686c00100000020000000000000000000000000000000000000000000027574d8a1eeedca2db279

    ///   0x0100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000370100000000010002010000002a0000000930783132393663333301c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000418160ddd01000201000000550000000001296c338ec91127ee4bdba0dd64fc9e6fdee0dc78a5deeeddf778e272418edd189abfa300061443d2f686c00100000020000000000000000000000000000000000000000000027574d8a1eeedca2db279
/// 0x0100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000380100000000010002010000002b0000000a3078303132393663333301c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000418160ddd01000201000000550000000001296c338ec91127ee4bdba0dd64fc9e6fdee0dc78a5deeeddf778e272418edd189abfa300061443d2f686c00100000020000000000000000000000000000000000000000000027574d8a1eeedca2db279
  }
}
