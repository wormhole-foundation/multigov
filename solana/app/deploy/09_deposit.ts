// Usage: npx ts-node app/deploy/09_deposit.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, USER2_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";

async function performDeposit(userKeypair: anchor.web3.Keypair) {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(userKeypair),
    {},
  );
  const user = provider.wallet.publicKey;
  const idl = (await Program.fetchIdl(STAKING_ADDRESS, provider))!;
  const program = new Program(idl, provider);

  const transaction = new Transaction();
  const fromAccount = await getAssociatedTokenAddress(
    WORMHOLE_TOKEN,
    provider.wallet.publicKey,
    true,
  );

  const toAccount = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
      user.toBuffer(),
    ],
    program.programId,
  )[0];

  const ix = createTransferInstruction(
    fromAccount,
    toAccount,
    provider.wallet.publicKey,
    50,
  );
  transaction.add(ix);

  const tx = await provider.sendAndConfirm(transaction, [], {
    skipPreflight: false,
  });

  console.log(`Deposit transaction completed successfully for user: ${user.toBase58()}`);
  console.log("Transaction signature:", tx);
}

async function main() {
  try {
    await performDeposit(USER_AUTHORITY_KEYPAIR);
    await performDeposit(USER2_AUTHORITY_KEYPAIR);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
