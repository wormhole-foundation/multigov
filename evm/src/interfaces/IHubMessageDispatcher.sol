// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

interface IHubMessageDispatcher {
  error InvalidTimelock();

  event MessageDispatched(bytes payload);
  event PublishConsistencyLevelUpdated(uint8 oldConsistency, uint8 newConsistency);
  event TimelockUpdated(address oldTimelock, address newTimelock);
  event WormholeCoreUpdated(address oldCore, address newCore);

  function dispatch(bytes memory _payload) external;
  function publishConsistencyLevel() external view returns (uint8);
  function setPublishConsistencyLevel(uint8 _consistencyLevel) external;
  function setTimelock(address _timelock) external;
  function setWormholeCore(address _core) external;
  function timelock() external view returns (address);
  function wormholeCore() external view returns (address);
}
