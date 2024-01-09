// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface Interface {
    error InvalidProposalId();

    event ProposalMetadataBridged(uint256 indexed proposalId, uint256 voteStart, uint256 voteEnd, bool isCanceled);

    function GOVERNOR() external view returns (address);
    function WORMHOLE_CORE() external view returns (address);
    function bridgeProposalMetadata(uint256 proposalId) external payable returns (uint256 sequence);
}
