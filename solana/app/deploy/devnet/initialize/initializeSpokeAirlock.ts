// Usage: npx ts-node app/deploy/devnet/initialize/initializeSpokeAirlock.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";

async function main() {
  try {
    const DEBUG = true;
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {},
    );

    let program: Program<Staking>;
    program = new Program(
      JSON.parse(fs.readFileSync("./target/idl/staking.json").toString()),
      provider,
    );

    const airlockPDA: PublicKey = PublicKey.findProgramAddressSync(
      [Buffer.from("airlock")],
      program.programId,
    )[0];

    await program.methods
      .initializeSpokeAirlock()
      .accounts({
        payer: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
        // @ts-ignore
        airlock: airlockPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: DEBUG });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
