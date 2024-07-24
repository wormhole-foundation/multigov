import { PublicKey } from "@solana/web3.js";
import { homedir } from "os";
import { loadKeypair } from "../../tests/utils/keys";
export const AUTHORITY_PATH = "/.config/solana/deployer.json";
export const AUTHORITY_KEYPAIR = loadKeypair(homedir() + AUTHORITY_PATH);

export const WORMHOLE_TOKEN = new PublicKey(
  "3XsW9v8Ar6RwEy2uga4c2JEcYc7sh1x9LtDYeUt8zvV1"
);

export const RPC_NODE = "https://api.devnet.solana.com";
