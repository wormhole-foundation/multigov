// Usage: npx ts-node app/deploy/016_initializeSpokeMessageExecutor.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  hubSolanaMessageDispatcherPublicKey,
  HUB_CHAIN_ID,
} from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet_consts";
import { Staking } from "../../target/types/staking";
import fs from "fs";
import { wasm } from "../StakeConnection";

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

    const messageExecutorPDA: PublicKey = PublicKey.findProgramAddressSync(
      [Buffer.from("spoke_message_executor")],
      program.programId,
    )[0];
    const config: PublicKey = PublicKey.findProgramAddressSync(
      [Buffer.from(wasm.Constants.CONFIG_SEED())],
      program.programId,
    )[0];

    await program.methods
      .initializeSpokeMessageExecutor(HUB_CHAIN_ID)
      .accounts({
        governanceAuthority: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
        // @ts-ignore
        executor: messageExecutorPDA,
        config: config,
        hubDispatcher: hubSolanaMessageDispatcherPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: DEBUG });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
