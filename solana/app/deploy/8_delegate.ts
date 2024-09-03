import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { WHTokenBalance } from "../whTokenBalance";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";

async function main() {
  try {
    const stakeAccountAddress = new PublicKey(
      // stakeAccountSecret.publicKey generated in  3_create_stake_account.ts
      "EHbjaCjypw3HAZMWskLhX1KtmVUDmNFrijPcBtfqH8S3",
    );

    const delegateeStakeAccountAddress = new PublicKey(
      // stakeAccountSecret.publicKey generated in  3_create_stake_account.ts
      "BdkvB5tRjYZMxbVPf7Xai6i5RPP6qXT4Zm7tmpHCmHaC",
    );

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
      stakeAccountAddress,
      delegateeStakeAccountAddress,
      WHTokenBalance.fromString("100"),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
