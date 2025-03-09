// Usage: npx ts-node app/e2e/external_program/initializeConfigPDA.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE,
  AIRLOCK_PDA_ADDRESS,
} from "../../deploy/devnet/constants";
import { ExternalProgram } from "./idl/external_program";
import externalProgramIdl from "./idl/external_program.json";

// Initialize the config account
async function initializeConfigPDA() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {},
    );

    const externalProgram = new Program<ExternalProgram>(
      externalProgramIdl as any,
      provider,
    );

    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("configV2")],
      externalProgram.programId,
    );
    console.log("configPDA:", configPDA);

    await externalProgram.methods
      .initialize(DEPLOYER_AUTHORITY_KEYPAIR.publicKey, AIRLOCK_PDA_ADDRESS)
      .accountsPartial({
        payer: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
        config: configPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

initializeConfigPDA();
