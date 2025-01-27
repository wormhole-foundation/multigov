// Usage: npx ts-node app/deploy/08_create_stake_account.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, USER2_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import { Staking } from "../../target/types/staking";

async function createStakeAccount(userKeypair: anchor.web3.Keypair) {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(userKeypair),
    {},
  );

  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
    STAKING_ADDRESS,
  );

  const tx = await stakeConnection.createStakeAccount();

  console.log(`Stake account created successfully for user: ${provider.wallet.publicKey.toBase58()}`);
  console.log("Transaction signature:", tx);
}

async function main() {
  try {
    await createStakeAccount(USER_AUTHORITY_KEYPAIR);
    await createStakeAccount(USER2_AUTHORITY_KEYPAIR);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
