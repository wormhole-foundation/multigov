// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";

/// @notice Handles sending proposal metadata such as proposal id, start date and end date from L1
/// to L2.
contract HubProposalMetadataSender {
  /// @notice The governor where proposals are fetched and bridged.
  IGovernor public immutable GOVERNOR;

  IWormhole public immutable WORMHOLE_CORE;

  error InvalidMsgFee();

  /// @notice The proposal id is an invalid proposal id.
  error InvalidProposalId();

  event ProposalMetadataBridged(uint256 indexed proposalId, uint256 voteStart, uint256 voteEnd, bool isCanceled);

  /// @param _governor The address of the hub chain governor.
  /// @param _core The wormhole core contract.
  constructor(address _governor, address _core) {
    GOVERNOR = IGovernor(_governor);
    WORMHOLE_CORE = IWormhole(_core);
  }

  /// @notice Publishes a messages with the proposal id, start block and end block
  /// @param proposalId The id of the proposal to bridge.
  /// @return sequence An identifier for the message published to L2.
  function bridgeProposalMetadata(uint256 proposalId) public payable returns (uint256 sequence) {
    uint256 voteStart = GOVERNOR.proposalSnapshot(proposalId);
    if (voteStart == 0) revert InvalidProposalId();
    uint256 voteEnd = GOVERNOR.proposalDeadline(proposalId);

    bool isCanceled = GOVERNOR.state(proposalId) == IGovernor.ProposalState.Canceled;
    uint256 wormholeFee = WORMHOLE_CORE.messageFee();
    if (wormholeFee != msg.value) revert InvalidMsgFee();

    // TODO Use encodePacked in the future
    bytes memory proposalCalldata = abi.encode(proposalId, voteStart, voteEnd, isCanceled);

    // TODO How are relayer fees handled? Initial impl assumes all cost borne on the relayer
    sequence = WORMHOLE_CORE.publishMessage{value: msg.value}(
      0, // TODO nonce: needed?
      proposalCalldata, // payload
      201 // TODO consistency level: where should we set it?
    );
    emit ProposalMetadataBridged(proposalId, voteStart, voteEnd, isCanceled);
  }
}
