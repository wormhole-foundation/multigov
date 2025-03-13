// Usage: npx ts-node app/deploy/devnet/update/claimVestingAdmin.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import {
  RPC_NODE,
  NEW_VESTING_ADMIN_KEYPAIR,
} from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(NEW_VESTING_ADMIN_KEYPAIR),
      {},
    );

    let program: Program<Staking>;
    program = new Program(
      JSON.parse(fs.readFileSync("./target/idl/staking.json").toString()),
      provider,
    );

    await program.methods
      .claimVestingAdmin()
      .accounts({ newVestingAdmin: NEW_VESTING_ADMIN_KEYPAIR.publicKey })
      .signers([NEW_VESTING_ADMIN_KEYPAIR])
      .rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
