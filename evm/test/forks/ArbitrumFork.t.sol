// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {SpokeForkTestBase} from "./SpokeForkTestBase.sol";

contract ArbitrumForkTest is SpokeForkTestBase {
  // --- Chain-Specific Constants (Arbitrum) ---
  address constant WORMHOLE_CORE = 0xa5f208e072434bC67592E4C49C1B991BA79BCA46;
  address constant SPOKE_EXECUTOR_ADDR = 0x8630614a9f6BCf7cc21D076Bf3C785803D6FBe34;
  address constant SPOKE_COLLECTOR_ADDR = 0xc87238fC06d39D7FdF373b7b0Efc82879dc188bF;
  address constant SPOKE_AGGREGATOR_ADDR = 0xe495E8632D2C335969F7CE1Ee1c6F4618ce0D780;
  address constant SPOKE_AIRLOCK_ADDR = 0xCf09FBb67e505f5F0e93389230a20864B17E4EAF;

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

  function _getExpectedWormholeCore() internal pure override returns (address) {
    return WORMHOLE_CORE;
  }
}
