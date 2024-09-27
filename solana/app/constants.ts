import { PublicKey } from "@solana/web3.js";

export const STAKING_ADDRESS = new PublicKey(
  "5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ",
);

export const CORE_BRIDGE_ADDRESS = new PublicKey(
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
);

/// Wormhole Hub Proposal Metadata Contract (Ethereum address)
export const hubProposalMetadata = new Uint8Array([
  0x69, 0xcb, 0xb9, 0xa5, 0x90, 0x72, 0x66, 0x36, 0x25, 0xa6, 0xe3, 0xeb,
  0x3a, 0xee, 0x31, 0xe4, 0x35, 0x21, 0x3f, 0x7b,
]);

/// Wormhole Hub Chain ID
export const hubChainId = 1;
