// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

contract GovernorMock {
  uint256 public proposalId;
  uint8 public support;
  string public reason;
  bytes public params;

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
    return 1;
  }
}
