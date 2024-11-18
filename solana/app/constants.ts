import { PublicKey } from "@solana/web3.js";

export const STAKING_ADDRESS = new PublicKey(
  "8t5PooRwQTcmN7BP5gsGeWSi3scvoaPqFifNi2Bnnw4g",
);

export const CORE_BRIDGE_ADDRESS = new PublicKey(
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
);

/// Wormhole Hub Proposal Metadata Contract (sepolia ethereum address)
export const hubProposalMetadata = new Uint8Array([
  0x26, 0xc7, 0x36, 0x62, 0x63, 0x3b, 0xd0, 0xd4, 0xa6, 0xba, 0x23, 0x1a, 0x10,
  0x01, 0xbb, 0xbc, 0xed, 0x8d, 0x2b, 0x21,
]);

/// Wormhole Hub Chain ID
export const hubChainId = 10002;

export const CHECKPOINTS_ACCOUNT_LIMIT = 654998;
export const TEST_CHECKPOINTS_ACCOUNT_LIMIT = 10;

export const MAX_VOTE_WEIGHT_WINDOW_LENGTH = 870;
