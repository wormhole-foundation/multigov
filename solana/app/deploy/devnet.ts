import { PublicKey } from "@solana/web3.js";
import { homedir } from "os";
import { loadKeypair } from "../../tests/utils/keys";
export const AUTHORITY_PATH = "/.config/solana/deployer.json";
export const AUTHORITY_KEYPAIR = loadKeypair(homedir() + AUTHORITY_PATH);

export const WORMHOLE_TOKEN = new PublicKey(
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ"
);

export const RPC_NODE = "https://api.devnet.solana.com";
