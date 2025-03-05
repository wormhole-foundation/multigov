// Usage: npx ts-node app/deploy/devnet/update/updateHubProposalMetadata.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  hubProposalMetadataUint8Array,
  RPC_NODE,
} from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";

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

    const airlockPDA: PublicKey = PublicKey.findProgramAddressSync(
      [Buffer.from("airlock")],
      program.programId,
    )[0];

    await program.methods
      .updateHubProposalMetadata(Array.from(hubProposalMetadataUint8Array))
      .accounts({
        payer: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
        airlock: airlockPDA,
      })
      .rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
