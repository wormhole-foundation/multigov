// Usage: npx ts-node app/deploy/08_create_stake_account.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER2_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import { Staking } from "../../target/types/staking";

async function main() {
  try {
    const DEBUG = true;
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
      STAKING_ADDRESS,
    );

    await stakeConnection.createStakeAccount();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
