// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeForkTestBase} from "./SpokeForkTestBase.sol";

contract BaseForkTest is SpokeForkTestBase {
  // --- Chain-Specific Constants (Base) ---
  address constant WORMHOLE_CORE = 0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6;
  address constant SPOKE_EXECUTOR_ADDR = 0x8630614a9f6BCf7cc21D076Bf3C785803D6FBe34;
  address constant SPOKE_COLLECTOR_ADDR = 0x23c860301e9D357623DA635c2176d85A0e561158;
  address constant SPOKE_AGGREGATOR_ADDR = 0x4C31eeEe22c08474A45e15Bb23c46A6f2b446FB4;
  address constant SPOKE_AIRLOCK_ADDR = 0xCf09FBb67e505f5F0e93389230a20864B17E4EAF;

  function _getRpcUrlEnvVarName() internal pure override returns (string memory) {
    return "BASE_RPC_URL";
  }

  function _getSpokeExecutorAddress() internal pure override returns (address) {
    return SPOKE_EXECUTOR_ADDR;
  }

  function _getSpokeAirlockAddress() internal pure override returns (address) {
    return SPOKE_AIRLOCK_ADDR;
  }

  function _getSpokeAggregatorAddress() internal pure override returns (address) {
    return SPOKE_AGGREGATOR_ADDR;
  }

  function _getSpokeCollectorAddress() internal pure override returns (address) {
    return SPOKE_COLLECTOR_ADDR;
  }

  function _getExpectedWormholeCore() internal pure override returns (address) {
    return WORMHOLE_CORE;
  }
}
