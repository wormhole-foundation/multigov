// Usage: npx ts-node app/deploy/022_updateGovernanceAuthority.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, GOVERNANCE_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet_consts";
import { Staking } from "../../target/types/staking";
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

    await program.methods
      .updateGovernanceAuthority()
      .accounts({
        governanceSigner: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
        newAuthority: GOVERNANCE_AUTHORITY_KEYPAIR.publicKey,
      })
      .rpc();

    await program.methods
      .claimGovernanceAuthority()
      .accounts({
        newAuthority: GOVERNANCE_AUTHORITY_KEYPAIR.publicKey,
      })
      .signers([GOVERNANCE_AUTHORITY_KEYPAIR])
      .rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
