// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";

// TODO valid spoke chain token holders must be able to cast their vote on proposals
// TODO must be a method for votes on spoke chain to be bridged to hub
// TODO revert if proposalId doesn't exist
// TODO revert if proposal is inactive
// TODO revert if invalid vote is cast
// TODO revert if voter has no vote weight
// TODO Compatible with Flexible voting on the L2
// TODO Message can only be bridged during the cast vote window period (Is this what we want)
contract SpokeVoteAggregator is EIP712, Nonces, SpokeMetadataCollector {
  bytes32 public constant BALLOT_TYPEHASH =
    keccak256("Ballot(uint256 proposalId,uint8 support,address voter,uint256 nonce)");

  enum ProposalState {
    Pending,
    Active,
    Expired
  }

  ERC20Votes public immutable VOTING_TOKEN;
  // TODO: Add a setter if we plan to keep this
  uint32 public CAST_VOTE_WINDOW;

  error InvalidSignature(address voter);
  error ProposalInactive();
  error InvalidVoteType();
  error NoWeight();

  struct ProposalVote {
    uint128 againstVotes;
    uint128 forVotes;
    uint128 abstainVotes;
  }

  enum VoteType {
    Against,
    For,
    Abstain
  }

  /// @notice A mapping of proposal id to proposal vote totals.
  mapping(uint256 proposalId => ProposalVote) public proposalVotes;

  event VoteBridged(uint256 indexed proposalId, uint256 voteAgainst, uint256 voteFor, uint256 voteAbstain);

  event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);

  constructor(
    address _core,
    uint16 _hubChainId,
    bytes32 _hubProposalMetadataSender,
    address _votingToken,
    uint32 _castVoteWindow,
    address _owner
  )
    // TODO: name, version
    EIP712("SpokeVoteAggregator", "1")
    SpokeMetadataCollector(_core, _hubChainId, _hubProposalMetadataSender, _owner)
  {
    VOTING_TOKEN = ERC20Votes(_votingToken);
    CAST_VOTE_WINDOW = _castVoteWindow;
  }

  function state(uint256 proposalId) external view virtual returns (ProposalState) {
    SpokeMetadataCollector.Proposal memory proposal = getProposal(proposalId);
    if (VOTING_TOKEN.clock() < proposal.voteStart) return ProposalState.Pending;
    else if (voteActiveInternal(proposalId)) return ProposalState.Active;
    else return ProposalState.Expired;
  }

  function castVote(uint256 proposalId, uint8 support) public returns (uint256) {
    return _castVote(proposalId, msg.sender, support, "");
  }

  function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) public returns (uint256) {
    return _castVote(proposalId, msg.sender, support, reason);
  }

  function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes memory signature)
    public
    returns (uint256)
  {
    // TODO: remove nonce pending a double-check that votes can't replay (think we're casting full weight vote)
    bool valid = SignatureChecker.isValidSignatureNow(
      voter,
      _hashTypedDataV4(keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support, voter, _useNonce(voter)))),
      signature
    );

    if (!valid) revert InvalidSignature(voter);

    return _castVote(proposalId, voter, support, "");
  }

  function bridgeVote(uint256 _proposalId) external payable {
    // TODO: Do we need this check? What are the implications of removing.
    if (!voteActiveHub(_proposalId)) revert ProposalInactive();

    ProposalVote memory vote = proposalVotes[_proposalId];

    bytes memory proposalCalldata = abi.encode(_proposalId, vote.againstVotes, vote.forVotes, vote.abstainVotes);
    _bridgeVote(proposalCalldata);
    emit VoteBridged(_proposalId, vote.againstVotes, vote.forVotes, vote.abstainVotes);
  }

  function internalVotingPeriodEnd(uint256 _proposalId) public view returns (uint256 _lastVotingBlock) {
    SpokeMetadataCollector.Proposal memory proposal = getProposal(_proposalId);
    _lastVotingBlock = proposal.voteEnd - CAST_VOTE_WINDOW;
  }

  // TODO Update for flexible voting, this will change with Flexible voting
  function _castVote(uint256 _proposalId, address _voter, uint8 _support, string memory _reason)
    internal
    returns (uint256)
  {
    if (!voteActiveInternal(_proposalId)) revert ProposalInactive();

    SpokeMetadataCollector.Proposal memory proposal = getProposal(_proposalId);
    uint256 weight = VOTING_TOKEN.getPastVotes(_voter, proposal.voteStart);
    if (weight == 0) revert NoWeight();

    if (_support == uint8(VoteType.Against)) proposalVotes[_proposalId].againstVotes += SafeCast.toUint128(weight);
    else if (_support == uint8(VoteType.For)) proposalVotes[_proposalId].forVotes += SafeCast.toUint128(weight);
    else if (_support == uint8(VoteType.Abstain)) proposalVotes[_proposalId].abstainVotes += SafeCast.toUint128(weight);
    else revert InvalidVoteType();
    emit VoteCast(_voter, _proposalId, _support, weight, _reason);
    return weight;
  }

  function voteActiveHub(uint256 proposalId) public view returns (bool active) {
    SpokeMetadataCollector.Proposal memory proposal = getProposal(proposalId);
    // TODO: do we need to use voting token clock or can we replace w more efficient block.timestamp
    uint256 _time = VOTING_TOKEN.clock();
    return _time <= proposal.voteEnd && _time >= proposal.voteStart;
  }

  function voteActiveInternal(uint256 proposalId) public view returns (bool active) {
    SpokeMetadataCollector.Proposal memory proposal = getProposal(proposalId);
    // TODO: do we need to use voting token clock or can we replace w more efficient block.timestamp
    uint256 _time = VOTING_TOKEN.clock();
    return _time <= internalVotingPeriodEnd(proposalId) && _time >= proposal.voteStart;
  }

  function _bridgeVote(bytes memory proposalCalldata) internal {
    WORMHOLE_CORE.publishMessage(
      0, // TODO nonce: needed?
      proposalCalldata, // payload
      201 // TODO consistency level: where should we set it?
    );
  }
}
