// Usage: npx ts-node app/deploy/mainnet/initialize/initializeSpokeMessageExecutor.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  hubSolanaMessageDispatcherPublicKey,
  HUB_CHAIN_ID,
  RPC_NODE,
} from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";
import { wasm } from "../../../StakeConnection";

async function main() {
  try {
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
      .rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
