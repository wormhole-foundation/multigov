// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubGovernorProposalExtender} from "src/HubGovernorProposalExtender.sol";

// , 1 days, minimumTime
contract HubGovernorProposalExtenderHarness is HubGovernorProposalExtender {
  constructor(
    address _whitelistedVoteExtender,
    uint48 _voteTimeExtension,
    address _owner,
    uint48 _minimumExtensionTime,
    uint32 _safeWindow,
    uint48 _minimumDecisionWindow
  )
    HubGovernorProposalExtender(
      _whitelistedVoteExtender,
      _voteTimeExtension,
      _owner,
      _minimumExtensionTime,
      _safeWindow,
      _minimumDecisionWindow
    )
  {}

  function exposed_setSafeWindow(uint48 _safeWindow) external {
    return _setSafeWindow(_safeWindow);
  }
}
