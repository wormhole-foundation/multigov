// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {MultiSenderWormholeReceiver} from "src/MultiSenderWormholeReceiver.sol";

contract HubVotePool is MultiSenderWormholeReceiver {
  IGovernor public immutable HUB_GOVERNOR;
  uint8 constant UNUSED_SUPPORT_PARAM = 1;

  error UnknownMessageEmitter();
  error InvalidProposalVote();

  event SpokeVoteCast(
    uint16 indexed emitterChainId, uint256 proposalId, uint256 voteAgainst, uint256 voteFor, uint256 voteAbstain
  );

  /// @dev Contains the distribution of a proposal vote.
  struct ProposalVote {
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  // Instead of nested mapping create encoding for the key
  mapping(bytes32 spokeProposalId => ProposalVote proposalVotes) public spokeProposalVotes;

  constructor(address _core, address _hubGovernor, address _hubTimelock)
    MultiSenderWormholeReceiver(_core, _hubTimelock)
  {
    HUB_GOVERNOR = IGovernor(_hubGovernor);
    // TODO: delegate
    // ERC20Votes(IFractionalGovernor(address(HUB_GOVERNOR)).token()).delegate(address(this));
  }

  function receiveMessage(bytes memory _encodedMessage) public override {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage,,) = _validateMessage(_encodedMessage);
    if (wormholeMessage.emitterAddress != spokeRegistry[wormholeMessage.emitterChainId]) revert UnknownMessageEmitter();

    (uint256 proposalId, uint128 againstVotes, uint128 forVotes, uint128 abstainVotes) =
      abi.decode(wormholeMessage.payload, (uint256, uint128, uint128, uint128));

    // TODO: does encode vs encodePacked matter here
    bytes32 _spokeProposalId = keccak256(abi.encode(wormholeMessage.emitterChainId, proposalId));
    ProposalVote memory existingSpokeVote = spokeProposalVotes[_spokeProposalId];
    if (
      existingSpokeVote.againstVotes > againstVotes || existingSpokeVote.forVotes > forVotes
        || existingSpokeVote.abstainVotes > abstainVotes
    ) revert InvalidProposalVote();

    // Save proposal vote
    spokeProposalVotes[_spokeProposalId] = ProposalVote(againstVotes, forVotes, abstainVotes);

    _castVote(
      proposalId,
      ProposalVote(
        againstVotes - existingSpokeVote.againstVotes,
        forVotes - existingSpokeVote.forVotes,
        abstainVotes - existingSpokeVote.abstainVotes
      ),
      wormholeMessage.emitterChainId
    );
  }

  function _castVote(uint256 proposalId, ProposalVote memory vote, uint16 emitterChainId) internal {
    bytes memory votes = abi.encodePacked(vote.againstVotes, vote.forVotes, vote.abstainVotes);

    HUB_GOVERNOR.castVoteWithReasonAndParams(proposalId, UNUSED_SUPPORT_PARAM, "aggregated cross-chain votes", votes);

    emit SpokeVoteCast(emitterChainId, proposalId, vote.againstVotes, vote.forVotes, vote.abstainVotes);
  }
}
