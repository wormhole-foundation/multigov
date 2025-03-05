// Usage: npx ts-node app/deploy/devnet/initialize/initializeVoteWeightWindowLengths.ts

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE, VOTE_WEIGHT_WINDOW_LENGTHS } from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";
import BN from "bn.js";

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

    await program.methods.initializeVoteWeightWindowLengths(new BN(VOTE_WEIGHT_WINDOW_LENGTHS)).rpc();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
