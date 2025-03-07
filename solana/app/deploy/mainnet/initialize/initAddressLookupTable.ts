// Usage: npx ts-node app/deploy/mainnet/initialize/initAddressLookupTable.ts

import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE,
  STAKING_ADDRESS,
  WORMHOLE_TOKEN,
} from "../constants";
import { initAddressLookupTable } from "../../../helpers/utils/lookup_table";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {},
    );

    const lookupTableAddress = await initAddressLookupTable(
      provider,
      WORMHOLE_TOKEN,
      STAKING_ADDRESS,
    );

    console.log("Lookup table address: ", lookupTableAddress.toBase58());
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
