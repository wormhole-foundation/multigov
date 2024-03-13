// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {QueryTest} from "wormhole-forge-test/query/QueryTest.sol";
import {Setup} from "wormhole/Setup.sol";
import {Implementation} from "wormhole/Implementation.sol";
import {Wormhole} from "wormhole/Wormhole.sol";

contract SpokeMetadataCollectorQueriesTest is Test {
  address public DEVNET_GUARDIAN = makeAddr("devnet guardian");
  uint256 constant TEST_CHAIN_ID = 2;
  uint256 constant GOVERNANCE_CHAIN_ID = 2;
  address GOVERNANCE_CONTRACT = makeAddr("governance contract");
  Wormhole public wormhole;

  function setUp() public {
    _setupWormhole();
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
}

contract AddProposal is SpokeMetadataCollectorQueriesTest {
  function test_addsProposal() public {
    // QueryTest.buildOffChainQueryRequestBytes
    // QueryTest.buildPerChainRequestBytes
    // QueryTest.buildEthCallRequestBytes

    // QueryTest.buildQueryResponseBytes
    // QueryTest.buildPerChainResponseBytes
    // QueryTest.buildEthCallResponseBytes
  }
}
