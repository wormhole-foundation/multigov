// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

import {SpokeChainMetadataCollector} from "src/SpokeChainMetadataCollector.sol";

// TODO valid spoke chain token holders must be able to cast their vote on proposals
// TODO must be a method for votes on spoke chain to be bridged to hub
// TODO revert if proposalId doesn't exist
// TODO revert if proposal is inactive
// TODO revert if invalid vote is cast
// TODO revert if voter has no vote weight
// TODO Compatible with Flexible voting on the L2
// TODO Message can only be bridged during the cast vote window period (Is this what we want)
contract SpokeVoteAggregator is SpokeChainMetadataCollector {
  enum ProposalState {
    Pending,
    Active,
    Canceled,
    Expired
  }

  ERC20Votes public immutable VOTING_TOKEN;

  constructor(address _core, uint16 _hubChainId, bytes32 _hubProposalMetadataSender, address _votingToken)
    SpokeChainMetadataCollector(_core, _hubChainId, _hubProposalMetadataSender)
  {
    VOTING_TOKEN = ERC20Votes(_votingToken);
  }

  function state(uint256 proposalId) external view virtual returns (ProposalState) {}
  function castVote(uint256 proposalId, uint8 support) public returns (uint256) {}
  function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) public {}
  function castVoteBySig(uint256 proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) public {}
  function bridgeVote(uint256 proposalId) external payable {}
  function internalPeriodEnd(uint256 proposalId) public view returns (uint256 _lastVotingBlock) {}
  function _castVote(uint256 proposalId, address voter, uint8 support, string memory reason) internal returns (uint256) {}
  function voteActiveHub(uint256 proposalId) public view returns (bool active) {}
  function voteActiveInternal(uint256 proposalId) public view returns (bool active) {}
}
