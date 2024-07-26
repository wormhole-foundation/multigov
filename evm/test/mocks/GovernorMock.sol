// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

contract GovernorMock {
  uint256 public proposalId;
  uint8 public support;
  string public reason;
  bytes public params;
  uint256 voteStart;
  uint256 public proposalThreshold;
  address public whitelistedProposer;
  ERC20VotesFake public token;

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

  function setProposalThreshold(uint256 _proposalThreshold) public virtual {
    proposalThreshold = _proposalThreshold;
  }

  function setWhitelistedProposer(address _proposer) public virtual {
    whitelistedProposer = _proposer;
  }

  function setToken(address _token) external {
    token = ERC20VotesFake(_token);
  }

  function getVotes(address account, uint256 blockNumber) public view returns (uint256) {
    return token.getPastVotes(account, blockNumber);
  }
}
