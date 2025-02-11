import { PublicKey } from "@solana/web3.js";
import { homedir } from "os";
import { loadKeypair } from "../../tests/utils/keys";

export const DEPLOYER_AUTHORITY_PATH = "/.config/solana/deployer.json";
export const DEPLOYER_AUTHORITY_KEYPAIR = loadKeypair(
  homedir() + DEPLOYER_AUTHORITY_PATH,
);

export const USER_AUTHORITY_PATH = "/.config/solana/user.json";
export const USER_AUTHORITY_KEYPAIR = loadKeypair(
  homedir() + USER_AUTHORITY_PATH,
);

export const USER2_AUTHORITY_PATH = "/.config/solana/user2.json";
export const USER2_AUTHORITY_KEYPAIR = loadKeypair(
  homedir() + USER2_AUTHORITY_PATH,
);

export const WORMHOLE_TOKEN = new PublicKey(
  "Exne2kdeGToBnC2WVSdt1gLy6fjnNftbPtsCPx8AuL7V",
);

export const RPC_NODE = "https://api.devnet.solana.com";

export const AIRLOCK_PDA_ADDRESS = new PublicKey(
  "2ejzW2eFPedskg1KcrjcFs9g1JorRVcMes1TBPpGbhdy",
);
