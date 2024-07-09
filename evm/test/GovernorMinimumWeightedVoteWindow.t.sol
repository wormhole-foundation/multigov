// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";

import {GovernorMinimumWeightedVoteWindow} from "src/extensions/GovernorMinimumWeightedVoteWindow.sol";

contract GovernorMinimumWeightedVoteWindowTest is Test {}

contract Constructor is GovernorMinimumWeightedVoteWindowTest {
		function testFuzz_CorrectlySetArgs(uint48 _initialVoteWeightWindowLength) public {
				new GovernorMinimumWeightedVoteWindow(_initialVoteWeightWindowLength);
		}
}
