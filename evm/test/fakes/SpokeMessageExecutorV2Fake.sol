// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeMessageExecutor} from "src/SpokeMessageExecutor.sol";

/// @dev This is a "fake" version 2 of the WToken, used only for testing that the upgrade functionality is
/// behaving as expected.
/// @custom:oz-upgrades-from WToken
contract SpokeMessageExecutorV2Fake is SpokeMessageExecutor {
  uint256 public fakeStateVar;

  function initializeFakeV2(uint256 _initialValue) public reinitializer(2) {
    fakeStateVar = _initialValue;
  }
}
