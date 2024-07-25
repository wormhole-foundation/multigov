import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet, } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  PublicKey,
  Connection,
} from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import BN from "bn.js";

async function main() {
  try {
    const DEBUG = true;

    const stakeAccountAddress = new PublicKey(
      // stakeAccountSecret.publicKey generated in  3_create_stake_account.ts
      "EHbjaCjypw3HAZMWskLhX1KtmVUDmNFrijPcBtfqH8S3"
    );

    const connection = new Connection(RPC_NODE);

    const provider = new AnchorProvider(
      connection,
      new Wallet(USER_AUTHORITY_KEYPAIR),
      {}
    );

    const idl = (await Program.fetchIdl(STAKING_ADDRESS, provider))!;

    const program = new Program(idl, provider);

    const toAccount = await getAssociatedTokenAddress(
      WORMHOLE_TOKEN,
      provider.wallet.publicKey,
      true
    );

    await program.methods
      .withdrawTokens(new BN(1))
      .accounts({
        currentDelegateStakeAccountCheckpoints: stakeAccountAddress,
        stakeAccountCheckpoints: stakeAccountAddress,
        destination: toAccount,
      })
      .rpc({ skipPreflight: DEBUG });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();

