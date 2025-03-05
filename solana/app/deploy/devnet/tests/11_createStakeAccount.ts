// Usage: npx ts-node app/deploy/devnet/tests/11_createStakeAccount.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import { RPC_NODE, USER2_AUTHORITY_KEYPAIR } from "../constants";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
    );

    await stakeConnection.createStakeAccount();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
