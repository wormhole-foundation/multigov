// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {IERC5805} from "@openzeppelin/contracts/interfaces/IERC5805.sol";
import {GovernorMinimumWeightedVoteWindow} from "src/extensions/GovernorMinimumWeightedVoteWindow.sol";

contract GovernorMinimumWeightedVoteWindowHarness is GovernorMinimumWeightedVoteWindow {
		constructor(uint48 _initialVoteWeightWindowLength) GovernorMinimumWeightedVoteWindow(_initialVoteWeightWindowLength) {}

		function token() public pure override returns (IERC5805) {
				return IERC5805(address(0));
		}

		function exposed_setVoteWeightWindow(uint48 _windowLength) public {
				_setVoteWeightWindow(_windowLength);
		}
}
