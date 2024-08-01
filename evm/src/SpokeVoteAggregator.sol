// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {GovernorMinimumWeightedVoteWindow} from "src/extensions/GovernorMinimumWeightedVoteWindow.sol";
import {IERC5805} from "@openzeppelin/contracts/interfaces/IERC5805.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {SpokeMetadataCollector} from "src/SpokeMetadataCollector.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";

/// @title SpokeVoteAggregator
/// @author [ScopeLift](https://scopelift.co)
/// @notice Used in a multichain governance system to receive and aggregate votes. This vote data should be periodically
/// queried by a crank-turner, who will relay the votes to the `HubGovernor`. A special note should be made here for the
/// `GovernorMinimumWeightedVoteWindow`, which is meant to mitigate/prevent double voting attacks across chains. This is
/// done by retrieving a voter's weight checkpoints within a certain period around the voteStart, and using the minimum
/// weight as the voter's weight.
contract SpokeVoteAggregator is EIP712, Nonces, Ownable, SpokeCountingFractional, GovernorMinimumWeightedVoteWindow {
  /// @notice The typehash for the ballot struct used in the EIP712 signature.
  bytes32 public constant BALLOT_TYPEHASH =
    keccak256("Ballot(uint256 proposalId,uint8 support,address voter,uint256 nonce)");

  /// @notice The voting token used for voting.
  ERC20Votes public immutable VOTING_TOKEN;

  /// @notice The spoke metadata collector used to retrieve proposal data.
  SpokeMetadataCollector public spokeMetadataCollector;

  /// @notice Thrown when a signature is invalid.
  error InvalidSignature(address voter);

  /// @notice Thrown when voting on a proposal that is inactive.
  error ProposalInactive();

  /// @notice Thrown when voting with an invalid vote type.
  error InvalidVoteType();

  /// @notice Thrown when voting from an address with no vote weight.
  error NoWeight();

  /// @notice Thrown when a non-owner tries to call an owner-gated method.
  error OwnerUnauthorizedAccount(address account);

  /// @notice Thrown when setting the owner to the zero address.
  error OwnerIsZeroAddress();

  /// @notice Emitted when a vote is cast.
  event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);

  /// @notice Emitted with a vote is cast with params.
  event VoteCastWithParams(
    address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason, bytes params
  );

  /// @param _spokeMetadataCollector Address of the spoke metadata collector.
  /// @param _votingToken Address of the voting token.
  /// @param _owner The initial owner of this spoke vote aggregator.
  /// @param _initialVoteWindow The moving window for vote weight checkpoints, meant to mitigate crosschain double
  /// voting attacks.
  constructor(address _spokeMetadataCollector, address _votingToken, address _owner, uint48 _initialVoteWindow)
    // TODO: name, version
    EIP712("SpokeVoteAggregator", "1")
    Ownable(_owner)
    GovernorMinimumWeightedVoteWindow(_initialVoteWindow)
  {
    VOTING_TOKEN = ERC20Votes(_votingToken);
    spokeMetadataCollector = SpokeMetadataCollector(_spokeMetadataCollector);
  }

  /// @notice Sets the vote weight window (the moving window over which the voter's minimum checkpoint is selected).
  /// Exists in order to mitigate crosschain double voting attacks.
  /// @param _voteWeightWindow The new vote weight window, in seconds.
  function setVoteWeightWindow(uint48 _voteWeightWindow) public {
    _checkOwner();
    _setVoteWeightWindow(_voteWeightWindow);
  }

  /// @notice Cast a vote on a proposal.
  /// @param _proposalId The id of the proposal to vote on.
  /// @param _support The support value of the vote.
  /// @return The weight of the vote.
  function castVote(uint256 _proposalId, uint8 _support) public returns (uint256) {
    return _castVote(_proposalId, msg.sender, _support, "");
  }

  /// @notice Cast a vote on a proposal with a reason.
  /// @param _proposalId The id of the proposal to vote on.
  /// @param _support The support value of the vote.
  /// @param _reason The reason for the vote.
  /// @return The weight of the vote.
  function castVoteWithReason(uint256 _proposalId, uint8 _support, string calldata _reason) public returns (uint256) {
    return _castVote(_proposalId, msg.sender, _support, _reason);
  }

  /// @notice Cast a vote on a proposal with a reason and parameters.
  /// @param _proposalId The id of the proposal to vote on.
  /// @param _support The support value of the vote.
  /// @param _reason The reason for the vote.
  /// @param _params The parameters for the vote.
  /// @return The weight of the vote.
  function castVoteWithReasonAndParams(
    uint256 _proposalId,
    uint8 _support,
    string calldata _reason,
    bytes memory _params
  ) public virtual returns (uint256) {
    return _castVote(_proposalId, msg.sender, _support, _reason, _params);
  }

  /// @notice Cast a vote on a proposal with a signature.
  /// @param _proposalId The id of the proposal to vote on.
  /// @param _support The support value of the vote.
  /// @param _voter The address of the voter.
  /// @param _signature The signature of the vote.
  /// @return The weight of the vote.
  function castVoteBySig(uint256 _proposalId, uint8 _support, address _voter, bytes memory _signature)
    public
    returns (uint256)
  {
    // TODO: remove nonce pending a double-check that votes can't replay (think we're casting full weight vote)
    bool valid = SignatureChecker.isValidSignatureNow(
      _voter,
      _hashTypedDataV4(keccak256(abi.encode(BALLOT_TYPEHASH, _proposalId, _support, _voter, _useNonce(_voter)))),
      _signature
    );

    if (!valid) revert InvalidSignature(_voter);

    return _castVote(_proposalId, _voter, _support, "");
  }

  /// @notice Returns the voting token.
  /// @return Address of the voting token.
  function token() public view virtual override returns (IERC5805) {
    return VOTING_TOKEN;
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

    SpokeMetadataCollector.Proposal memory proposal = spokeMetadataCollector.getProposal(_proposalId);

    uint256 weight = _getVotes(_voter, proposal.voteStart, "");
    if (weight == 0) revert NoWeight();
    _countVote(_proposalId, _voter, _support, weight, _params);

    if (_params.length == 0) emit VoteCast(_voter, _proposalId, _support, weight, _reason);
    else emit VoteCastWithParams(_voter, _proposalId, _support, weight, _reason, _params);
    return weight;
  }

  /// @notice Checks if a proposal is active.
  /// @param _proposalId The id of the proposal to check.
  /// @return True if the proposal is active, false otherwise.
  function voteActiveInternal(uint256 _proposalId) public view returns (bool) {
    SpokeMetadataCollector.Proposal memory _proposal = spokeMetadataCollector.getProposal(_proposalId);
    // TODO: do we need to use voting token clock or can we replace w more efficient block.timestamp
    return VOTING_TOKEN.clock() >= _proposal.voteStart;
  }

  /// @notice Returns the vote weight for a given account at a specific timepoint.
  /// @param _account The address used to get the voting weight.
  /// @param _timepoint The timestamp used as the end of the vote window.
  /// @return The voting weight.
  function getVotes(address _account, uint256 _timepoint) public view returns (uint256) {
    return _getVotes(_account, _timepoint, "");
  }
}
