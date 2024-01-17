// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test} from "forge-std/Test.sol";

import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {TestConstants} from "test/TestConstants.sol";

contract SpokeMetadataCollectorTest is Test, TestConstants {}

contract Constructor is SpokeMetadataCollectorTest {
  function testFuzz_Correctly_sets_all_args(
    address _core,
    uint16 _hubChainId,
    bytes32 _hubProposalMetadataSender,
    address _owner
  ) public {
    vm.assume(_owner != address(0));
    SpokeMetadataCollector spokeMetadataCollector =
      new SpokeMetadataCollector(_core, _hubChainId, _hubProposalMetadataSender, _owner);
    assertEq(
      spokeMetadataCollector.registeredSenderChain(), _hubChainId, "The registered sender chain id is not correctly set"
    );
    assertEq(
      spokeMetadataCollector.registeredSenderAddress(),
      _hubProposalMetadataSender,
      "The registered sender address is not corretly set"
    );
  }

  function testFuzz_RevertIf_Owner_is_zero_address(
    address _core,
    uint16 _hubChainId,
    bytes32 _hubProposalMetadataSender
  ) public {
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new SpokeMetadataCollector(_core, _hubChainId, _hubProposalMetadataSender, address(0));
  }
}
