// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";

// TODO valid spoke chain token holders must be able to cast their vote on proposals
// TODO must be a method for votes on spoke chain to be bridged to hub
// TODO revert if proposalId doesn't exist
// TODO revert if proposal is inactive
// TODO revert if invalid vote is cast
// TODO revert if voter has no vote weight
// TODO Compatible with Flexible voting on the L2
// TODO Message can only be bridged during the cast vote window period (Is this what we want)
contract SpokeVoteAggregator is EIP712, Nonces, SpokeMetadataCollector, SpokeCountingFractional {
  bytes32 public constant BALLOT_TYPEHASH =
    keccak256("Ballot(uint256 proposalId,uint8 support,address voter,uint256 nonce)");

  enum ProposalState {
    Pending,
    Active,
    Expired
  }

  ERC20Votes public immutable VOTING_TOKEN;
  uint32 public safeWindow;
  address public owner;

  error InvalidSignature(address voter);
  error ProposalInactive();
  error InvalidVoteType();
  error NoWeight();
  error OwnerUnauthorizedAccount(address account);
  error OwnerIsZeroAddress();

  event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);
  event VoteCastWithParams(
    address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason, bytes params
  );

  constructor(
    address _core,
    uint16 _hubChainId,
    address _hubProposalMetadata,
    address _votingToken,
    uint32 _safeWindow,
    address _owner
  )
    // TODO: name, version
    EIP712("SpokeVoteAggregator", "1")
    SpokeMetadataCollector(_core, _hubChainId, _hubProposalMetadata)
  {
    VOTING_TOKEN = ERC20Votes(_votingToken);
    _setSafeWindow(_safeWindow);
    _setOwner(_owner);
  }

  function setSafeWindow(uint32 _safeWindow) external {
    _checkOwner();
    _setSafeWindow(_safeWindow);
  }

  function isVotingSafe(uint256 _proposalId) external view returns (bool) {
    SpokeMetadataCollector.Proposal memory proposal = getProposal(_proposalId);
    return (proposal.voteEnd - safeWindow) >= block.timestamp;
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

  function castVoteWithReasonAndParams(uint256 proposalId, uint8 support, string calldata reason, bytes memory params)
    public
    virtual
    returns (uint256)
  {
    return _castVote(proposalId, msg.sender, support, reason, params);
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

  function setOwner(address newOwner) public {
    _checkOwner();
    owner = newOwner;
  }

  function _castVote(uint256 _proposalId, address _voter, uint8 _support, string memory _reason)
    internal
    returns (uint256)
  {
    return _castVote(_proposalId, _voter, _support, _reason, "");
  }

  // TODO Update for flexible voting, this will change with Flexible voting
  function _castVote(uint256 _proposalId, address _voter, uint8 _support, string memory _reason, bytes memory _params)
    internal
    returns (uint256)
  {
    if (!voteActiveInternal(_proposalId)) revert ProposalInactive();

    SpokeMetadataCollector.Proposal memory proposal = getProposal(_proposalId);
    uint256 weight = VOTING_TOKEN.getPastVotes(_voter, proposal.voteStart);
    if (weight == 0) revert NoWeight();
    _countVote(_proposalId, _voter, _support, weight, _params);

    if (_params.length == 0) emit VoteCast(_voter, _proposalId, _support, weight, _reason);
    else emit VoteCastWithParams(_voter, _proposalId, _support, weight, _reason, _params);
    return weight;
  }

  function _checkOwner() internal view {
    if (msg.sender != owner) revert OwnerUnauthorizedAccount(msg.sender);
  }

  function _setSafeWindow(uint32 _safeWindow) internal {
    safeWindow = _safeWindow;
  }

  function _setOwner(address _newOwner) internal {
    owner = _newOwner;
  }

  function voteActiveInternal(uint256 proposalId) public view returns (bool active) {
    SpokeMetadataCollector.Proposal memory proposal = getProposal(proposalId);
    // TODO: do we need to use voting token clock or can we replace w more efficient block.timestamp
    uint256 _time = VOTING_TOKEN.clock();
    return _time <= proposal.voteEnd && _time >= proposal.voteStart;
  }
}
