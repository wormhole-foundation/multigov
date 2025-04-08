// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeForkTestBase} from "./SpokeForkTestBase.sol";

contract OptimismForkTest is SpokeForkTestBase {
  // --- Chain-Specific Constants (Optimism) ---
  address constant WORMHOLE_CORE = 0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722;
  address constant SPOKE_EXECUTOR_ADDR = 0xDaEfB7A94027c9c1414c27e84B9667a8f4bEC365;
  address constant SPOKE_COLLECTOR_ADDR = 0x423Da2a1D7e14f22B60cd9A5bd83d714f3AFe2De;
  address constant SPOKE_AGGREGATOR_ADDR = 0x75F755950D59d2007A0C90457fDc190732567cC5;
  address constant SPOKE_AIRLOCK_ADDR = 0x6753c396D52744ac82AEd0f62F9E3420ea7589da;

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
