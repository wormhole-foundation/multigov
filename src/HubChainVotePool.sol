// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract HubChainVotePool {
  IWormhole public immutable WORMHOLE_CORE;
  IGovernor public immutable HUB_GOVERNOR;
  uint8 constant UNUSED_SUPPORT_PARAM = 1;

  error InvalidWormholeMessage(string);
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

  mapping(uint16 emitterChain => bytes32 emitterAddress) spokeRegistry;

  // Instead of nested mapping create encoding for the key
  mapping(bytes32 spokeProposalId => ProposalVote proposalVotes) spokeProposalVotes;

  constructor(address _core, address _hubGovernor) {
    WORMHOLE_CORE = IWormhole(_core);
    HUB_GOVERNOR = IGovernor(_hubGovernor);
    // TODO: delegate
    // ERC20Votes(IFractionalGovernor(address(HUB_GOVERNOR)).token()).delegate(address(this));
  }

  // TODO: Make sure vote came from an authorized sender. Does it need to be both caller and sender?
  function receiveMessage(bytes memory _encodedMessage) public {
    // call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      WORMHOLE_CORE.parseAndVerifyVM(_encodedMessage);

    if (!valid) revert InvalidWormholeMessage(reason);
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

    HUB_GOVERNOR.castVoteWithReasonAndParams(
      proposalId, UNUSED_SUPPORT_PARAM, "rolled-up vote from governance L2 token holders", votes
    );

    emit SpokeVoteCast(emitterChainId, proposalId, vote.againstVotes, vote.forVotes, vote.abstainVotes);
  }
}
