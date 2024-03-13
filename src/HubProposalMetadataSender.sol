// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IGovernor} from "@openzeppelin-contracts/governance/IGovernor.sol";
import {WormholeDispatcher} from "src/WormholeDispatcher.sol";
import {GovernorTimelockControl} from "@openzeppelin-contracts/governance/extensions/GovernorTimelockControl.sol";

/// @notice Handles sending proposal metadata such as proposal id, start date and end date from L1
/// to L2.
contract HubProposalMetadataSender is WormholeDispatcher {
  /// @notice The governor where proposals are fetched and bridged.
  IGovernor public immutable GOVERNOR;

  /// @notice The proposal id is an invalid proposal id.
  error InvalidProposalId();

  event ProposalMetadataBridged(uint256 indexed proposalId, uint256 voteStart, uint256 voteEnd);

  /// @param _governor The address of the hub chain governor.
  /// @param _core The wormhole core contract.
  constructor(address _governor, address _core, uint8 _dispatchConsistencyLevel)
    WormholeDispatcher(GovernorTimelockControl(payable(_governor)).timelock(), _core, _dispatchConsistencyLevel)
  {
    GOVERNOR = IGovernor(_governor);
  }

  /// @notice Publishes a messages with the proposal id, start block and end block
  /// @param proposalId The id of the proposal to bridge.
  /// @return sequence An identifier for the message published to L2.
  function bridgeProposalMetadata(uint256 proposalId) public payable returns (uint256 sequence) {
    uint256 voteStart = GOVERNOR.proposalSnapshot(proposalId);
    if (voteStart == 0) revert InvalidProposalId();
    uint256 voteEnd = GOVERNOR.proposalDeadline(proposalId);

    // TODO Use encodePacked in the future
    bytes memory proposalCalldata = abi.encode(proposalId, voteStart, voteEnd);

    // TODO How are relayer fees handled? Initial impl assumes all cost borne on the relayer
    sequence = _publishMessage(proposalCalldata);
    emit ProposalMetadataBridged(proposalId, voteStart, voteEnd);
  }
}
