// Usage: npx ts-node app/deploy/devnet/tests/12_deposit.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  RPC_NODE,
  STAKING_ADDRESS,
  USER_AUTHORITY_KEYPAIR,
  WORMHOLE_TOKEN,
} from "../constants";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(USER_AUTHORITY_KEYPAIR),
      {},
    );
    const user = provider.wallet.publicKey;
    const idl = (await Program.fetchIdl(STAKING_ADDRESS, provider))!;
    const program = new Program(idl, provider);

    const transaction = new Transaction();
    const from_account = await getAssociatedTokenAddress(
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
      from_account,
      toAccount,
      provider.wallet.publicKey,
      50,
    );
    transaction.add(ix);

    const tx = await provider.sendAndConfirm(transaction, [], {
      skipPreflight: false,
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
