// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeForkTestBase} from "./SpokeForkTestBase.sol";

contract ArbitrumForkTest is SpokeForkTestBase {
  // --- Chain-Specific Constants (Arbitrum) ---
  address constant SPOKE_EXECUTOR_ADDR = 0x907E7f4Ec3aD1D51C62D085eC1ED336100957773;
  address constant SPOKE_COLLECTOR_ADDR = 0xBd9B592b82CF10cC8C21b64B322BC6f9397B07B7;
  address constant SPOKE_AGGREGATOR_ADDR = 0x6dEfA659A9726925307a45B30Ffe2Da45ED90811;
  address constant SPOKE_AIRLOCK_ADDR = 0x1D57040e3Fb498C05735ec4BCa68366c84Ed22A3;
  uint16 constant ARBITRUM_CHAIN_ID = 23; // Wormhole Chain ID for Arbitrum Mainnet

  // --- Implementation of Abstract Getters ---

  function _getRpcUrlEnvVarName() internal pure override returns (string memory) {
    return "ARBITRUM_RPC_URL";
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
    return ARBITRUM_CHAIN_ID;
  }

  function _getExpectedWormholeCore() internal pure override returns (address) {
    // Arbitrum Mainnet Wormhole Core
    return 0xa5f208e072434bC67592E4C49C1B991BA79BCA46;
  }

  // All test logic is inherited from SpokeForkTestBase
}
