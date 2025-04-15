// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeForkTestBase} from "./SpokeForkTestBase.sol";

contract OptimismForkTest is SpokeForkTestBase {
  // --- Chain-Specific Constants (Optimism) ---
  address constant WORMHOLE_CORE = 0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722;
  address constant SPOKE_EXECUTOR_ADDR = 0x8630614a9f6BCf7cc21D076Bf3C785803D6FBe34;
  address constant SPOKE_COLLECTOR_ADDR = 0xF5966B41f02064c18c27b308CB7AEdcaD4B5CA99;
  address constant SPOKE_AGGREGATOR_ADDR = 0x0A447C68166B486E84a87B869018c040063A1f16;
  address constant SPOKE_AIRLOCK_ADDR = 0xCf09FBb67e505f5F0e93389230a20864B17E4EAF;

  function _getRpcUrlEnvVarName() internal pure override returns (string memory) {
    return "OPTIMISM_RPC_URL";
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
