// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Implementation} from "wormhole/Implementation.sol";
import {Setup} from "wormhole/Setup.sol";
import {Wormhole} from "wormhole/Wormhole.sol";
import {QueryResponse} from "wormhole/query/QueryResponse.sol";
import {SpokeMetadataCollectorHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";

contract WormholeEthQueryTest is Test {
  address constant DEVNET_GUARDIAN = 0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe;
  uint256 constant DEVNET_GUARDIAN_PRIVATE_KEY = 0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0;
  uint16 constant MAINNET_CHAIN_ID = 2;
  uint8 constant VERSION = 1;
  uint8 constant OFF_CHAIN_SENDER = 0;
  bytes constant OFF_CHAIN_SIGNATURE =
    hex"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  uint256 constant GOVERNANCE_CHAIN_ID = 2;
  bytes signature =
    hex"ff0c222dc9e3655ec38e212e9792bf1860356d1277462b6bf747db865caca6fc08e6317b64ee3245264e371146b1d315d38c867fe1f69614368dc4430bb560f200";
  address GOVERNANCE_CONTRACT = 0x8a907De47E00830a2b742db65e938a3ea1070A2E; // Pooltogether governor
  Wormhole public wormhole;
  SpokeMetadataCollectorHarness spokeMetadataCollector;

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

  function getSignature(bytes memory response, address _getSig) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
    bytes32 responseDigest = QueryResponse(_getSig).getResponseDigest(response);
    (v, r, s) = vm.sign(DEVNET_GUARDIAN_PRIVATE_KEY, responseDigest);
  }
}
