// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

interface ISpokeLieutenant {
  error FailedInnerCall();
  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  function HUB_CHAIN_ID() external view returns (uint16);
  function HUB_TIMELOCK() external view returns (bytes32);
  function WORMHOLE_CORE() external view returns (address);
  function receiveMessage(bytes memory _encodedMessage) external;
}
