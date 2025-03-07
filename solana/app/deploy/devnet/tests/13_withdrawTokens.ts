// Usage: npx ts-node app/deploy/devnet/tests/13_withdrawTokens.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import { WHTokenBalance } from "../../../whTokenBalance";
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

    const user = provider.wallet.publicKey;
    let stakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(user);
    let stakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    if (!stakeAccountCheckpointsAddress) {
      throw new Error(`stakeAccountCheckpointsAddress is not defined`);
    }
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
