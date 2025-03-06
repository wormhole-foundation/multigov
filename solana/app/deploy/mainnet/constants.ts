import { PublicKey } from "@solana/web3.js";
import { homedir } from "os";
import { loadKeypair } from "../../../tests/utils/keys";
import { contracts } from "@wormhole-foundation/sdk-base";

export const RPC_NODE = "https://api.mainnet-beta.solana.com";

/// Wormhole Token (W) (mainnet solana address)
export const WORMHOLE_TOKEN = new PublicKey(
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
);

export const STAKING_ADDRESS = new PublicKey(
  "AFuHPdrQGsW8rNQ4oEFF35sm5fg36gwrxyqjkjKvi6ap",
);

export const CORE_BRIDGE_PID = new PublicKey(
  contracts.coreBridge.get("Mainnet", "Solana")!, // worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth
);
console.log(CORE_BRIDGE_PID);

/// Wormhole Hub Proposal Metadata Contract (mainnet ethereum address)
export const HUB_PROPOSAL_METADATA_ADDRESS =
  "0x1a3e5624769c3dc9106347a239523e4a08d85c38"; // TODO: needs to be updated after a deployment to ethereum mainnet
export const hubProposalMetadataUint8Array = new Uint8Array(
  HUB_PROPOSAL_METADATA_ADDRESS.slice(2)
    .toLowerCase()
    .match(/.{1,2}/g)
    ?.map((byte) => parseInt(byte, 16)),
);

/// Wormhole Hub Chain ID
// https://wormhole.com/docs/build/reference/chain-ids/#__tabbed_1_1
export const HUB_CHAIN_ID = 2; // Mainnet

export const CHECKPOINTS_ACCOUNT_LIMIT = 654998;

/// Wormhole hubSolanaMessageDispatcher Contract (mainnet ethereum address)
export const HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS =
  "0xaeb78fb7ddedbbcab908e91e94f1fb04a23fbce5"; // TODO: needs to be updated after a deployment to ethereum mainnet
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

export const DEPLOYER_AUTHORITY_PATH = "/.config/solana/deployer.json";
export const DEPLOYER_AUTHORITY_KEYPAIR = loadKeypair(
  homedir() + DEPLOYER_AUTHORITY_PATH,
);

export const GOVERNANCE_AUTHORITY_PATH =
  "/.config/solana/governanceAuthority.json";
export const GOVERNANCE_AUTHORITY_KEYPAIR = loadKeypair(
  homedir() + GOVERNANCE_AUTHORITY_PATH,
);

export const VESTING_ADMIN_PATH = "/.config/solana/vestingAdmin.json";
export const VESTING_ADMIN_KEYPAIR = loadKeypair(
  homedir() + VESTING_ADMIN_PATH,
);

export const VOTE_WEIGHT_WINDOW_LENGTHS = 10 * 60; // 10 minutes
