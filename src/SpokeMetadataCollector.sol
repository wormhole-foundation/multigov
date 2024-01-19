// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

contract SpokeMetadataCollector {
  IWormhole public immutable WORMHOLE_CORE;
  uint16 public immutable HUB_CHAIN_ID;
  bytes32 public immutable HUB_PROPOSAL_METADATA_SENDER;

  struct Proposal {
    uint256 voteStart;
    uint256 voteEnd;
  }

  mapping(uint256 proposalId => Proposal) internal proposals;

  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  event ProposalCreated(uint256 proposalId, uint256 startBlock, uint256 endBlock);

  constructor(address _core, uint16 _hubChainId, bytes32 _hubProposalMetadataSender) {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_CHAIN_ID = _hubChainId;
    HUB_PROPOSAL_METADATA_SENDER = _hubProposalMetadataSender;
  }

  function getProposal(uint256 proposalId) public view returns (Proposal memory) {
    return proposals[proposalId];
  }

  function receiveMessage(bytes memory _encodedMessage) public {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);

    if (!valid) revert InvalidWormholeMessage(reason);

    // TODO: Assumes we only receive metadata from a single hub ProposalMetadataSender
    if (
      wormholeMessage.emitterChainId != HUB_CHAIN_ID || wormholeMessage.emitterAddress != HUB_PROPOSAL_METADATA_SENDER
    ) revert UnknownMessageEmitter();
    (uint256 proposalId, uint256 voteStart, uint256 voteEnd) =
      abi.decode(wormholeMessage.payload, (uint256, uint256, uint256));

    _addProposal(proposalId, voteStart, voteEnd);
  }

  function _addProposal(uint256 proposalId, uint256 voteStart, uint256 voteEnd) internal {
    proposals[proposalId] = Proposal(voteStart, voteEnd);
    emit ProposalCreated(proposalId, voteStart, voteEnd);
  }
}
