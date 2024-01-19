// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

interface ISpokeMessageExecutor {
  error AlreadyProcessedMessage();
  error InvalidCaller();
  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  event ProposalExecuted(uint256 proposalId);

  function HUB_CHAIN_ID() external view returns (uint16);
  function HUB_DISPATCHER() external view returns (bytes32);
  function SPOKE_INDEX() external view returns (uint256);
  function WORMHOLE_CORE() external view returns (address);
  function airlock() external view returns (address);
  function messageReceived(bytes32 messageHash) external view returns (bool exectured);
  function receiveMessage(bytes memory _encodedMessage) external payable;
  function setAirlock(address _newAirlock) external;
}
