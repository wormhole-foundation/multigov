import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet, } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
} from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import { Staking } from "../../target/types/staking";
import fs from "fs";

async function main() {
  try {
    const DEBUG = true;

    const stakeAccountSecret = new Keypair();

    console.log(stakeAccountSecret)
    console.log(stakeAccountSecret.publicKey)

    const connection = new Connection(RPC_NODE);

    const provider = new AnchorProvider(
      connection,
      new Wallet(USER_AUTHORITY_KEYPAIR),
      {}
    );

    let program: Program<Staking>;
    program = new Program(
      JSON.parse(fs.readFileSync("./target/idl/staking.json").toString()),
      provider
    );

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
      STAKING_ADDRESS
    );

    const user = provider.wallet.publicKey;

    const [metadataAccount, metadataBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(
          wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()
        ),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [custodyAccount, custodyBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [authorityAccount, authorityBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .createStakeAccount(user)
      .preInstructions([
        await program.account.checkpointData.createInstruction(
          stakeAccountSecret,
          wasm.Constants.CHECKPOINT_DATA_SIZE()
        ),
      ])
      .accounts({
        stakeAccountCheckpoints: stakeAccountSecret.publicKey,
        mint: WORMHOLE_TOKEN,
      })
      .signers([stakeAccountSecret])
      .rpc({
        skipPreflight: DEBUG,
      });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();

