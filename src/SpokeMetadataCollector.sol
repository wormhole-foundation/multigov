// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {WormholeReceiver} from "src/WormholeReceiver.sol";

contract SpokeMetadataCollector is WormholeReceiver {
  struct Proposal {
    uint256 voteStart;
    uint256 voteEnd;
  }

  mapping(uint256 proposalId => Proposal) internal proposals;

  error UnknownMessageEmitter();

  event ProposalCreated(uint256 proposalId, uint256 startBlock, uint256 endBlock);

  // TODO should we revert if the hubChainId or the proposal metadata sender are zero values
  constructor(address _core, uint16 _hubChainId, bytes32 _hubProposalMetadataSender, address _owner)
    WormholeReceiver(_core, _owner)
  {
    _setRegisteredSender(_hubChainId, _hubProposalMetadataSender);
  }

  function getProposal(uint256 proposalId) public view returns (Proposal memory) {
    return proposals[proposalId];
  }

  function receiveMessage(bytes memory _encodedMessage) public override {
    (IWormhole.VM memory wormholeMessage,,) = _validMessage(_encodedMessage);

    // TODO: Assumes we only receive metadata from a single hub ProposalMetadataSender
    _onlyValidSender(wormholeMessage.emitterChainId, wormholeMessage.emitterAddress);
    (uint256 proposalId, uint256 voteStart, uint256 voteEnd) =
      abi.decode(wormholeMessage.payload, (uint256, uint256, uint256));

    _addProposal(proposalId, voteStart, voteEnd);
  }

  function _addProposal(uint256 proposalId, uint256 voteStart, uint256 voteEnd) internal {
    proposals[proposalId] = Proposal(voteStart, voteEnd);
    emit ProposalCreated(proposalId, voteStart, voteEnd);
  }
}
