import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  USER_AUTHORITY_KEYPAIR,
  USER2_AUTHORITY_KEYPAIR,
  WORMHOLE_TOKEN,
  RPC_NODE,
} from "./devnet_consts";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

const connection = new Connection(RPC_NODE);
const provider = new AnchorProvider(
  connection,
  new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
  {},
);

async function transferWToken(
  fromPublicKey: PublicKey,
  toPublicKey: PublicKey,
  amount: number,
) {
  const fromTokenAccount = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    fromPublicKey,
  );
  const toTokenAccount = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    toPublicKey,
  );

  let tx = new Transaction();
  tx.instructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
      toTokenAccount,
      toPublicKey,
      WORMHOLE_TOKEN,
    ),
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromPublicKey,
      amount,
    ),
  ];

  const signature = await provider.sendAndConfirm(tx, [
    DEPLOYER_AUTHORITY_KEYPAIR,
  ]);
  console.log(`Tokens sent successfully. Signature: ${signature}`);
}

transferWToken(
  DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
  USER_AUTHORITY_KEYPAIR.publicKey,
  100000000,
).catch(console.error);

transferWToken(
  DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
  USER2_AUTHORITY_KEYPAIR.publicKey,
  100000000,
).catch(console.error);
