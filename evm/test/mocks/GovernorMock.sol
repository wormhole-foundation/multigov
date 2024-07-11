// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

contract GovernorMock {
  uint256 public proposalId;
  uint8 public support;
  string public reason;
  bytes public params;
  uint256 voteStart;

  function castVoteWithReasonAndParams(
    uint256 _proposalId,
    uint8 _support,
    string calldata _reason,
    bytes memory _params
  ) public virtual returns (uint256) {
    proposalId = _proposalId;
    support = _support;
    reason = _reason;
    params = _params;
    return _proposalId;
  }

  function propose(address[] memory, uint256[] memory, bytes[] memory, string memory) public virtual returns (uint256) {
    voteStart = block.timestamp;
    return voteStart;
  }

  function proposalSnapshot(uint256) public view virtual returns (uint256) {
    return voteStart;
  }

  function votingPeriod() public pure returns (uint256) {
    return 7 days;
  }
}
