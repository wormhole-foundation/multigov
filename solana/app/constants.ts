import { PublicKey } from "@solana/web3.js";

export const STAKING_ADDRESS = new PublicKey(
  "5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ",
);

export const CORE_BRIDGE_ADDRESS = new PublicKey(
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
);

/// Wormhole Hub Proposal Metadata Contract (Ethereum address)
export const hubProposalMetadata = new Uint8Array([
  0x25, 0x74, 0x80, 0x2D, 0xb8, 0x59, 0x0e, 0xe5, 0xC9, 0xEF, 0xC5, 0xeB, 0xeB,
  0xFe, 0xf1, 0xE1, 0x74, 0xb7, 0x12, 0xFC,
]);

/// Wormhole Hub Chain ID
export const hubChainId = 1;
