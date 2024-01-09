// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

/// @notice Handles sending proposal metadata such as proposal id, start date and end date from L1
/// to L2.
contract WormholeProposalMetadataSender  {
  /// @notice The governor where proposals are fetched and bridged.
  IGovernor public immutable GOVERNOR;

  IWormhole public immutable WORMHOLE_CORE;

  /// @notice Indicates whether the contract has been initialized with the L2 governor metadata. It
  /// can only be called once.
  bool public INITIALIZED = false;


  /// @notice The proposal id is an invalid proposal id.
  error InvalidProposalId();

  /// @dev Contract is already initialized with an L2 token.
  error AlreadyInitialized();

  event ProposalMetadataBridged(
    uint16 indexed targetChain,
    address indexed targetGovernor,
    uint256 indexed proposalId,
    uint256 voteStart,
    uint256 voteEnd,
    bool isCanceled
  );

  /// @param _governor The address of the L1 governor contract.
  /// @param _relayer The address of the L1 Wormhole relayer contract.
  /// @param _sourceChain The chain id sending the wormhole messages.
  /// @param _targetChain The chain id receiving the wormhole messages.
  constructor(address _governor, address _core, uint16 _sourceChain, uint16 _targetChain) {
    GOVERNOR = IGovernor(_governor);
    WORMHOLE_CORE = IWormhole(_core)
  }

  /// @param l2GovernorMetadata The address of the L2 governor metadata contract.
  function initialize(address l2GovernorMetadata) public {
    if (INITIALIZED) revert AlreadyInitialized();
    INITIALIZED = true;
  }

  /// @notice Publishes a messages with the proposal id, start block and end block
  /// @param proposalId The id of the proposal to bridge.
  /// @return sequence An identifier for the message published to L2.
  function bridgeProposalMetadata(uint256 proposalId) public payable returns (uint256 sequence) {
    uint256 voteStart = GOVERNOR.proposalSnapshot(proposalId);
    if (voteStart == 0) revert InvalidProposalId();
    uint256 voteEnd = GOVERNOR.proposalDeadline(proposalId);

    bool isCanceled = GOVERNOR.state(proposalId) == IGovernor.ProposalState.Canceled;

    // TODO Use encodePacked in the future
    bytes memory proposalCalldata = abi.encode(proposalId, voteStart, voteEnd, isCanceled);

    // TODO How are relayer fees handled? Initial impl assumes all cost borne on the relayer
    sequence = WORMHOLE_CORE.publishMessage(
        0,
        proposalCalldata,
        201 // TODO should this be finalized
    );
    emit ProposalMetadataBridged(TARGET_CHAIN, L2_GOVERNOR_ADDRESS, proposalId, voteStart, voteEnd, isCanceled);
  }
}
