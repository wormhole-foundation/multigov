// Usage: npx ts-node app/deploy/devnet/update/updateVestingAdmin.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { VESTING_ADMIN_KEYPAIR, RPC_NODE } from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(VESTING_ADMIN_KEYPAIR),
      {},
    );

    let program: Program<Staking>;
    program = new Program(
      JSON.parse(fs.readFileSync("./target/idl/staking.json").toString()),
      provider,
    );

    const NEW_VESTING_ADMIN_ADDRESS = new PublicKey(
      "E1R3XdHgEYmsoLdZSQmhWrcD979bn5qK1bzr7pqMn2UQ",
    );

    await program.methods
      .updateVestingAdmin()
      .accounts({ newVestingAdmin: NEW_VESTING_ADMIN_ADDRESS })
      .rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
