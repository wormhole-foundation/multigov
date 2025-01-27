// Usage: npx ts-node app/deploy/11_delegate.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { WHTokenBalance } from "../whTokenBalance";
import { STAKING_ADDRESS } from "../constants";
import {
  USER_AUTHORITY_KEYPAIR,
  USER2_AUTHORITY_KEYPAIR,
  RPC_NODE,
} from "./devnet";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delegateStake(
  userKeypair: anchor.web3.Keypair,
  amount: string,
  delegateTo?: PublicKey,
) {
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

  await sleep(2000);
  await stakeConnection.delegate(delegateTo, WHTokenBalance.fromString(amount));

  console.log(`Delegation successful for user: ${provider.wallet.publicKey.toBase58()}`);
  if (delegateTo) {
    console.log(`Delegated to: ${delegateTo.toBase58()}`);
  }
}

async function main() {
  try {
    // First user delegates to himself
    await delegateStake(USER_AUTHORITY_KEYPAIR, "10000000");
    // Second user delegates to himself
    await delegateStake(USER2_AUTHORITY_KEYPAIR, "10000000");
    // First user delegates to second user
    await delegateStake(USER_AUTHORITY_KEYPAIR, "10000000", USER2_AUTHORITY_KEYPAIR.publicKey);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
