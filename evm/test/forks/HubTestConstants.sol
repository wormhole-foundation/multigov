// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

contract HubTestConstants {
  // Deployed Contract Addresses (from mainnet-test-deploy-contracts.md)
  address constant TIMELOCK_ADDR = 0x0fAA8fc7A60809B3557d5Dbe463B64F94de5ac06;
  address constant EXTENDER_ADDR = 0xB85D4a7D0661Afa0EFEFF9E3B6Fc82bf427e6C69;
  address constant HUB_VOTE_POOL_ADDR = 0x6D87469dC04aec896dB03Df9B1b9Ba29535CC206;
  address constant GOV_ADDR = 0x50b97697DbDa7a38f249966E02CCE6064657c54B;
  address constant HUB_EVM_VOTE_DECODER_ADDR = 0xa891e332E50E2d3105a5F9b85cFBbFc1D8E05541;
  address constant HUB_SOLANA_VOTE_DECODER_ADDR = 0xc70cc0f137fA23b5A42EE48a9A48E52c345E8dA4;
  address constant HUB_METADATA_ADDR = 0xe1485b53e6E94aD4B82b19E48DA1911d2E19bFaE;
  address constant HUB_MSG_DISPATCHER_ADDR = 0xb2F162945eF0631F62FE4421dc6Ec5eCDf92EF59;
  address constant HUB_SOLANA_DISPATCHER_ADDR = 0xadB8de6dfB41a1Fce6635460E77bEaDc73148BE4;
  address constant HUB_EVM_AGG_PROPOSER_ADDR = 0xb2490491FBb846B314D3ce65D77f9f27Ef964b4F;
  // Testnet WToken address (replace with actual for prod verification)
  address constant W_TOKEN_ADDR = 0x691d45404441c4a297ecCc8dE29C033afCeaac3e;

  // Testnet Spoke Addresses & Chain IDs
  address constant ARBITRUM_SPOKE_AGG_ADDR = 0x6dEfA659A9726925307a45B30Ffe2Da45ED90811;
  uint16 constant ARBITRUM_CHAIN_ID = 23;
  address constant BASE_SPOKE_AGG_ADDR = 0x31eD7EAa0CCA7e95a93339843a1C257b87e31E3d;
  uint16 constant BASE_CHAIN_ID = 30;
  address constant OPTIMISM_SPOKE_AGG_ADDR = 0x75F755950D59d2007A0C90457fDc190732567cC5;
  uint16 constant OPTIMISM_CHAIN_ID = 24;

  // Placeholder Wormhole Foundation Address
  address constant WORMHOLE_FOUNDATION_ADDR = 0x6dF497fa3bC0a44F384d099FbBE47304FEE4B55B;

  // Expected Parameters
  uint256 constant EXPECTED_MIN_DELAY = 300;
  string constant EXPECTED_GOV_NAME = "Wormhole Governor";
  uint48 constant EXPECTED_VOTING_DELAY = 1800;
  uint32 constant EXPECTED_VOTING_PERIOD = 2 hours;
  uint256 constant EXPECTED_PROPOSAL_THRESHOLD = 500_000e18;
  uint208 constant EXPECTED_QUORUM = 1_000_000e18;
  address constant EXPECTED_WORMHOLE_CORE = 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B;
  uint48 constant EXPECTED_VOTE_WEIGHT_WINDOW = 10 minutes;
  uint48 constant EXPECTED_VOTE_TIME_EXTENSION = 5 minutes;
  uint48 constant EXPECTED_MIN_EXTENSION_TIME = 1 minutes;
  uint8 constant EXPECTED_CONSISTENCY_LEVEL = 0;
  uint48 constant EXPECTED_MAX_QUERY_OFFSET = 10 minutes;
  uint8 constant EXPECTED_SOLANA_DECIMALS = 6;

  // Roles
  bytes32 public constant TIMELOCK_ADMIN_ROLE = 0x00; // bytes32(0)
  bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
  bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
  bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
}
