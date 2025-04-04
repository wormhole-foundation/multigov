// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeForkTestBase} from "./SpokeForkTestBase.sol";

contract BaseForkTest is SpokeForkTestBase {
  // --- Chain-Specific Constants (Base) ---
  address constant SPOKE_EXECUTOR_ADDR = 0xDaEfB7A94027c9c1414c27e84B9667a8f4bEC365;
  address constant SPOKE_COLLECTOR_ADDR = 0xfdB5EBB8eEE8D9E29460fBF2134bBECA44CEC7c7;
  address constant SPOKE_AGGREGATOR_ADDR = 0x31eD7EAa0CCA7e95a93339843a1C257b87e31E3d;
  address constant SPOKE_AIRLOCK_ADDR = 0x6753c396D52744ac82AEd0f62F9E3420ea7589da;
  uint16 constant BASE_CHAIN_ID = 30; // Wormhole Chain ID for Base Mainnet

  // --- Implementation of Abstract Getters ---

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

  function _getSelfChainId() internal pure override returns (uint16) {
    return BASE_CHAIN_ID;
  }

  function _getExpectedWormholeCore() internal pure override returns (address) {
    // Base Mainnet Wormhole Core
    return 0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6;
  }

  // All test logic is inherited from SpokeForkTestBase
}
