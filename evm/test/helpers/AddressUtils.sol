// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

contract AddressUtils {
  function addressToBytes32(address a) internal pure returns (bytes32) {
    return bytes32(uint256(uint160(a)));
  }
}
