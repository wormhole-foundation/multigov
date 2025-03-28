// Usage: npx ts-node app/deploy/devnet/tests/11_createStakeAccount.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import {
  USER_AUTHORITY_KEYPAIR,
  USER2_AUTHORITY_KEYPAIR,
  RPC_NODE,
} from "../constants";

async function createStakeAccount(userKeypair: anchor.web3.Keypair) {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(connection, new Wallet(userKeypair), {});

  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
  );

  const tx = await stakeConnection.createStakeAccount();

  console.log(
    `Stake account created successfully for user: ${provider.wallet.publicKey.toBase58()}`,
  );
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
