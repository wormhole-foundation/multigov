// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {HubGovernor} from "src/HubGovernor.sol";
import {HubVotePool} from "src/HubVotePool.sol";

contract HubTestConstants {
  address payable constant GOV_ADDR = payable(0x239B1F17E6Efa75662cB87781025538babF1Cf6b);
  address immutable TIMELOCK_ADDR = 0xfBc580c0289121673EfB7375fF111bD2A4db4654;
  address immutable EXTENDER_ADDR = 0x3dDeaA121C33eDBF802984096aB450a6051E0e73;
  address immutable HUB_VOTE_POOL_ADDR = 0x2E57935d31Ef7F161e7bC69Fca873E04097ff3af;
  address immutable HUB_EVM_VOTE_DECODER_ADDR = 0x210dD4E9F8da7967792b0Ff73a340140aF6A2115;
  address immutable HUB_SOLANA_VOTE_DECODER_ADDR = 0xACA7A131B94E6972B9BB7A48Ff6f5f1E8181Fa1E;
  address constant HUB_METADATA_ADDR = 0xE92610200A579A09Fe440f697C19afadDa8a7fE8;
  address constant HUB_MSG_DISPATCHER_ADDR = 0x9B3679B7e3E51d4f1E0eeF3977B400011365CbCE;
  address constant HUB_SOLANA_DISPATCHER_ADDR = 0x6b608339E64662F49425b02e0c82ea904492BFab;
  address constant HUB_EVM_AGG_PROPOSER_ADDR = 0xC7D279Fcd5b122BDEc63112F31967b2eAB080Af6;
  address constant W_TOKEN_ADDR = 0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91;

  // Testnet Spoke Addresses & Chain IDs
  address constant ARBITRUM_SPOKE_AGG_ADDR = 0xe495E8632D2C335969F7CE1Ee1c6F4618ce0D780;
  uint16 constant ARBITRUM_CHAIN_ID = 23;
  address constant BASE_SPOKE_AGG_ADDR = 0x4C31eeEe22c08474A45e15Bb23c46A6f2b446FB4;
  uint16 constant BASE_CHAIN_ID = 30;
  address constant OPTIMISM_SPOKE_AGG_ADDR = 0x0A447C68166B486E84a87B869018c040063A1f16;
  uint16 constant OPTIMISM_CHAIN_ID = 24;

  // Placeholder Wormhole Foundation Address
  address constant WORMHOLE_FOUNDATION_ADDR = 0x4afAa38A39a1A80F4fe13DA24Bf4AB70d3455CF7;

  // Expected Parameters
  uint256 constant EXPECTED_MIN_DELAY = 4 days;
  string constant EXPECTED_GOV_NAME = "Wormhole Governor";
  uint48 constant EXPECTED_VOTING_DELAY = 2 days;
  uint32 constant EXPECTED_VOTING_PERIOD = 5 days;
  uint256 constant EXPECTED_PROPOSAL_THRESHOLD = 1_000_000e18;
  uint208 constant EXPECTED_QUORUM = 350_000_000e18;
  address constant EXPECTED_WORMHOLE_CORE = 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B;
  uint48 constant EXPECTED_VOTE_WEIGHT_WINDOW = 5 minutes;
  uint48 constant EXPECTED_VOTE_TIME_EXTENSION = 24 hours;
  uint48 constant EXPECTED_MIN_EXTENSION_TIME = 12 hours;
  uint8 constant EXPECTED_CONSISTENCY_LEVEL = 0;
  uint48 constant EXPECTED_MAX_QUERY_OFFSET = 5 minutes;
  uint8 constant EXPECTED_SOLANA_DECIMALS = 6;

  // Roles
  bytes32 public constant TIMELOCK_ADMIN_ROLE = 0x00; // bytes32(0)
  bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
  bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
  bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
}
