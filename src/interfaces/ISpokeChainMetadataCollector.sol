// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface ISpokeChainMetadataCollector {
  error InvalidWormholeMessage(string);
  error UnknownMessageEmitter();

  event ProposalCanceled(uint256 proposalId);
  event ProposalCreated(uint256 proposalId, uint256 startBlock, uint256 endBlock);

  function HUB_CHAIN_ID() external view returns (uint16);
  function HUB_PROPOSAL_METADATA_SENDER() external view returns (bytes32);
  function WORMHOLE_CORE() external view returns (address);
  function receiveMessage(bytes memory _encodedMessage) external;
}
