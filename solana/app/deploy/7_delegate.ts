import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { WHTokenBalance } from "../whTokenBalance";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";

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
      undefined,
      WHTokenBalance.fromString("100"),
    );

    const user = provider.wallet.publicKey;
    const stakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddress(user);
    console.log(stakeAccountCheckpointsAddress);

    await stakeConnection.delegate(
      stakeAccountCheckpointsAddress,
      stakeAccountCheckpointsAddress,
      WHTokenBalance.fromString("100"),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
