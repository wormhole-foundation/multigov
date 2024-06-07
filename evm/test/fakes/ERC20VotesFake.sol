// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Time} from "@openzeppelin/contracts/utils/types/Time.sol";

/// @notice An ERC20Votes token to help test the L2 voting system
contract ERC20VotesFake is ERC20Mock, ERC20Permit, ERC20Votes {
  constructor() ERC20Mock() ERC20Permit("ERC20Mock") {}

  function clock() public view virtual override returns (uint48) {
    return Time.timestamp();
  }

  function CLOCK_MODE() public view virtual override returns (string memory) {
    // Check that the clock was not modified
    if (clock() != Time.timestamp()) revert ERC6372InconsistentClock();
    return "mode=timestamp";
  }

  function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
    ERC20Votes._update(from, to, amount);
  }

  function nonces(address owner) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
    return Nonces.nonces(owner);
  }

  function mint(address _account, uint208 _amount) external {
    _mint(_account, _amount);
  }
}
