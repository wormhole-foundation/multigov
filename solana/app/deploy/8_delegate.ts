import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { WHTokenBalance } from "../whTokenBalance";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, USER2_AUTHORITY_PATH, RPC_NODE } from "./devnet";

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
      STAKING_ADDRESS,
    );

    await stakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("100"),
    );

    const user2Provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_PATH),
      {},
    );

    const user2StakeConnection = await StakeConnection.createStakeConnection(
      connection,
      user2Provider.wallet as Wallet,
      STAKING_ADDRESS,
    );

    await user2StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("100"),
    );

    await stakeConnection.delegate(
      user2StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("100"),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
