// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {WormholeMock} from "wormhole-sdk/testing/helpers/WormholeMock.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";

contract WormholeCoreMock is WormholeMock {
  uint32 public ghostPublishMessageNonce;
  bytes public ghostPublishMessagePayload;
  uint8 public ghostPublishMessageConsistencyLevel;
  uint16 public override chainId;

  constructor(uint16 _chainId) {
    chainId = _chainId;
  }

  function publishMessage(uint32 _nonce, bytes memory _payload, uint8 _consistencyLevel)
    public
    payable
    override
    returns (uint64)
  {
    ghostPublishMessageNonce = _nonce;
    ghostPublishMessagePayload = _payload;
    ghostPublishMessageConsistencyLevel = _consistencyLevel;
    return 1;
  }

  function parseAndVerifyVM(bytes calldata encodedVM)
    external
    pure
    override
    returns (IWormhole.VM memory vm, bool valid, string memory reason)
  {
    vm = abi.decode(encodedVM, (IWormhole.VM));
    reason = "";
    valid = true;
  }
}
