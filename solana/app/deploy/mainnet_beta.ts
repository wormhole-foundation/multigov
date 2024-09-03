import { PublicKey } from "@solana/web3.js";
import { homedir } from "os";
import { loadKeypair } from "../../tests/utils/keys";
export const AUTHORITY_PATH = "/.config/solana/deployer.json";
export const AUTHORITY_KEYPAIR = loadKeypair(homedir() + AUTHORITY_PATH);

export const WORMHOLE_TOKEN = new PublicKey(
  "Exne2kdeGToBnC2WVSdt1gLy6fjnNftbPtsCPx8AuL7V",
);

export const RPC_NODE = "https://api.mainnet-beta.solana.com";
