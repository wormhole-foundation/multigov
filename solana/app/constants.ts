import { PublicKey } from "@solana/web3.js";

export const STAKING_ADDRESS = new PublicKey(
  "5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ",
);

export const CORE_BRIDGE_ADDRESS = new PublicKey(
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
);

/// Wormhole Hub Proposal Metadata Contract (Ethereum address)
export const hubProposalMetadata = new Uint8Array([
  0x25, 0x74, 0x80, 0x2d, 0xb8, 0x59, 0x0e, 0xe5, 0xc9, 0xef, 0xc5, 0xeb, 0xeb,
  0xfe, 0xf1, 0xe1, 0x74, 0xb7, 0x12, 0xfc,
]);

/// Wormhole Hub Chain ID
export const hubChainId = 1;

export const TEST_CHECKPOINTS_ACCOUNT_LIMIT = 2;
export const CHECK_POINTS_ACCOUNT_LIMIT = 654998;
