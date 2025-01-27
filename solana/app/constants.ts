import { PublicKey } from "@solana/web3.js";

export const STAKING_ADDRESS = new PublicKey(
  "AFuHPdrQGsW8rNQ4oEFF35sm5fg36gwrxyqjkjKvi6ap",
);

export const CORE_BRIDGE_ADDRESS = new PublicKey(
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
);

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

export const HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS =
  "0xaeb78fb7ddedbbcab908e91e94f1fb04a23fbce5";
const hubSolanaMessageDispatcherHex20 =
  HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS.slice(2);
const hubSolanaMessageDispatcherHex32 =
  "000000000000000000000000" + hubSolanaMessageDispatcherHex20.toLowerCase();
const hubSolanaMessageDispatcherUint8Array32 = new Uint8Array(
  hubSolanaMessageDispatcherHex32
    .match(/.{1,2}/g)
    ?.map((byte) => parseInt(byte, 16)),
);
export const hubSolanaMessageDispatcherUint8Array20 =
  hubSolanaMessageDispatcherUint8Array32.slice(-20);
export const hubSolanaMessageDispatcherPublicKey = new PublicKey(
  hubSolanaMessageDispatcherUint8Array32,
);
// console.log("hubSolanaMessageDispatcherPublicKey:", hubSolanaMessageDispatcherPublicKey);

/// Wormhole HubGovernor Contract (sepolia ethereum address)
export const HUB_GOVERNOR_ADDRESS =
  "0x491f237e770ab05da1e40658fab531f8a5acf7a8";

/// Wormhole HubSolanaSpokeVoteDecoder Contract (sepolia ethereum address)
export const HUB_SOLANA_SPOKE_VOTE_DECODER_ADDRESS =
  "0x40e80d89d61d023568db528090c3e56ae472b0e5";

/// Wormhole HubVotePool Contract (sepolia ethereum address)
export const HUB_VOTE_POOL_ADDRESS =
  "0x1004c781763c70f5f11aa64b0e5b34e1442a3c02";
