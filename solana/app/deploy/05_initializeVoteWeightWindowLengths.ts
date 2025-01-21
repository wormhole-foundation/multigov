// Usage: npx ts-node app/deploy/05_initializeVoteWeightWindowLengths.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import { Staking } from "../../target/types/staking";
import fs from "fs";
import BN from "bn.js";

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

    await program.methods.initializeVoteWeightWindowLengths(new BN(10)).rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
