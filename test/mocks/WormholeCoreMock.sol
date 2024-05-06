// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

contract WormholeCoreMock {
  uint32 public ghostPublishMessageNonce;
  bytes public ghostPublishMessagePayload;
  uint8 public ghostPublishMessageConsistencyLevel;

  function publishMessage(uint32 _nonce, bytes memory _payload, uint8 _consistencyLevel) public returns (uint256) {
    ghostPublishMessageNonce = _nonce;
    ghostPublishMessagePayload = _payload;
    ghostPublishMessageConsistencyLevel = _consistencyLevel;
    return 1;
  }
}
