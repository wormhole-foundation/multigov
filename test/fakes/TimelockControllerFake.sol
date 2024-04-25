// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {TimelockController} from "@openzeppelin-contracts/governance/TimelockController.sol";

contract TimelockControllerFake is TimelockController {
  constructor(address _admin) TimelockController(20, new address[](0), new address[](0), _admin) {}
}
