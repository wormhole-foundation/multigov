// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {QueryResponse, ParsedPerChainQueryResponse, EthCallQueryResponse} from "wormhole/query/QueryResponse.sol";

import {ICrossChainVoteWeight} from "src/interfaces/ICrossChainVoteWeight.sol";

contract EvmCallVoteWeight is ICrossChainVoteWeight, QueryResponse, ERC165 {
  constructor(address _core) QueryResponse(_core) {}

  function getVoteWeight(ParsedPerChainQueryResponse memory _perChainResp)
    external
    view
    returns (CrossChainVoteWeightResult memory)
  {
    EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(_perChainResp);

    if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

    address queriedAccount = _extractAccountFromCalldata(_ethCalls.result[0].callData);
    if (queriedAccount != msg.sender) revert InvalidCaller(msg.sender, queriedAccount);

    return (
      CrossChainVoteWeightResult({
        voteWeight: abi.decode(_ethCalls.result[0].result, (uint256)),
        blockTime: _ethCalls.blockTime
      })
    );
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return interfaceId == type(ICrossChainVoteWeight).interfaceId || ERC165.supportsInterface(interfaceId);
  }

  function _extractAccountFromCalldata(bytes memory callData) internal pure returns (address) {
    if (callData.length < 24) revert InvalidCalldataLength();

    address extractedAccount;
    assembly {
      extractedAccount := mload(add(add(callData, 0x20), 4))
    }

    return extractedAccount;
  }
}
