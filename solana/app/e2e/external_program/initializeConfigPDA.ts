import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { USER2_AUTHORITY_KEYPAIR, RPC_NODE, AIRLOCK_PDA_ADDRESS } from "../../deploy/devnet";
import { ExternalProgram } from "./idl/external_program";
import externalProgramIdl from "./idl/external_program.json";

// Initialize the config account
async function initializeConfigPDA() {
  try {
    const connection = new Connection(RPC_NODE);
    const user2Provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );

    const externalProgram = new Program<ExternalProgram>(
      externalProgramIdl as any,
      user2Provider,
    );

    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      externalProgram.programId,
    );
    console.log("configPDA:",configPDA)

    await externalProgram.methods
      .initialize(AIRLOCK_PDA_ADDRESS)
      .accountsPartial({
        payer: USER2_AUTHORITY_KEYPAIR.publicKey,
        config: configPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([USER2_AUTHORITY_KEYPAIR])
      .rpc();    
  } catch (err) {
    console.error("Error:", err);
  }
}

initializeConfigPDA();
