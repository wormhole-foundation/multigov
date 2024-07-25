import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import { initAddressLookupTable } from "../../tests/utils/utils";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);

    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {}
    );

    const lookupTableAddress = await initAddressLookupTable(
      provider,
      WORMHOLE_TOKEN
    );

    console.log("Lookup table address: ", lookupTableAddress.toBase58());
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
