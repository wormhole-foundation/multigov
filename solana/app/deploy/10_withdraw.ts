// Usage: npx ts-node app/deploy/10_withdraw.ts

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

    const user = provider.wallet.publicKey;
    let stakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(user);
    let stakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    let stakeAccount = await stakeConnection.loadStakeAccount(
      stakeAccountCheckpointsAddress,
    );
    await stakeConnection.withdrawTokens(
      stakeAccount,
      WHTokenBalance.fromString("20"),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
