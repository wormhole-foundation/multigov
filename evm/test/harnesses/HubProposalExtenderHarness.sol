// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubProposalExtender} from "src/HubProposalExtender.sol";

// , 1 days, minimumTime
contract HubProposalExtenderHarness is HubProposalExtender {
  constructor(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _owner,
    uint48 _minimumExtensionTime,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  )
    HubProposalExtender(
      _whitelistedVoteExtender,
      _voteTimeExtension,
      _owner,
      _minimumExtensionTime
    )
  {}
}
