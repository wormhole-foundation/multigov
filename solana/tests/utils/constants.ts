import { contracts } from "@wormhole-foundation/sdk-base";
import { PublicKey } from "@solana/web3.js";

/// Wormhole Hub Proposal Metadata Contract (sepolia ethereum address)
export const HUB_PROPOSAL_METADATA_ADDRESS =
  "0x1a3e5624769c3dc9106347a239523e4a08d85c38";
export const hubProposalMetadataUint8Array = new Uint8Array(
  HUB_PROPOSAL_METADATA_ADDRESS.slice(2)
    .toLowerCase()
    .match(/.{1,2}/g)
    ?.map((byte) => parseInt(byte, 16)),
);

/// Wormhole Hub Chain ID
export const HUB_CHAIN_ID = 10002; // SEPOLIA

export const CHECKPOINTS_ACCOUNT_LIMIT = 654998;
export const TEST_CHECKPOINTS_ACCOUNT_LIMIT = 15;

export const CORE_BRIDGE_PID = new PublicKey(
  contracts.coreBridge.get("Testnet", "Solana")!, // 3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5
);
