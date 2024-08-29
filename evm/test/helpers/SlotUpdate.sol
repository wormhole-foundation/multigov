// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

contract SlotUpdate {
  address public test;

  function updateTest(address _newTest) public {
    test = _newTest;
  }
}
