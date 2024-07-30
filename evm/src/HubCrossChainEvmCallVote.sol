// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
  QueryResponse,
  ParsedPerChainQueryResponse,
  ParsedQueryResponse,
  EthCallQueryResponse
} from "wormhole/query/QueryResponse.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {ICrossChainVote} from "src/interfaces/ICrossChainVote.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

contract HubCrossChainEvmCallVote is ICrossChainVote, QueryResponse, ERC165 {
  HubVotePool public immutable HUB_VOTE_POOL;

  constructor(address _core, address _hubVotePool) QueryResponse(_core) {
    HUB_VOTE_POOL = HubVotePool(_hubVotePool);
  }

  function crossChainVote(ParsedPerChainQueryResponse memory _perChainResp) external returns (QueryVote memory) {
    EthCallQueryResponse memory _ethCalls = parseEthCallQueryResponse(_perChainResp);

    // verify contract and chain is correct
    bytes32 addr = HUB_VOTE_POOL.spokeRegistry(_perChainResp.chainId);
    bool isValidSpokeAddress = _isValidSpokeAddress(addr, _ethCalls.result[0].contractAddress);
    if (!isValidSpokeAddress) revert UnknownMessageEmitter();

    if (_ethCalls.result.length != 1) revert TooManyEthCallResults(_ethCalls.result.length);

    (uint256 proposalId, uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
      abi.decode(_ethCalls.result[0].result, (uint256, uint128, uint128, uint128));

    bytes32 _spokeProposalId = keccak256(abi.encode(_perChainResp.chainId, proposalId));
    return (
      QueryVote({
        proposalId: proposalId,
        spokeProposalId: _spokeProposalId,
        proposalVote: ProposalVote(againstVotes, forVotes, abstainVotes),
        chainId: _perChainResp.chainId
      })
    );
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return interfaceId == type(ICrossChainVote).interfaceId || ERC165.supportsInterface(interfaceId);
  }

  function _isValidSpokeAddress(bytes32 registeredSpokeAddress, address queriedContract) internal returns (bool) {
    if (registeredSpokeAddress != bytes32(uint256(uint160(queriedContract))) || registeredSpokeAddress == bytes32("")) {
      return false;
    }
    return true;
  }
}
