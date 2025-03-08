// Usage: npx ts-node app/deploy/devnet/tests/14_delegate.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import { WHTokenBalance } from "../../../whTokenBalance";
import {
  USER_AUTHORITY_KEYPAIR,
  USER2_AUTHORITY_KEYPAIR,
  RPC_NODE,
} from "../constants";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(USER_AUTHORITY_KEYPAIR),
      {},
    );
    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
    );

    await stakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10000000"),
    );
    await sleep(10000);

    const user2Provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );
    const user2StakeConnection = await StakeConnection.createStakeConnection(
      connection,
      user2Provider.wallet as Wallet,
    );

    await user2StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10000000"),
    );
    await sleep(10000);

    await stakeConnection.delegate(
      user2StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10000000"),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
