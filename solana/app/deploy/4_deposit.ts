import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet, } from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  Transaction,
  Connection,
} from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";

async function main() {
  const stakeAccountAddress = new PublicKey(
    "EHbjaCjypw3HAZMWskLhX1KtmVUDmNFrijPcBtfqH8S3"
  );

  const connection = new Connection(RPC_NODE);

  const provider = new AnchorProvider(
    connection,
    new Wallet(AUTHORITY_KEYPAIR),
    {}
  );

  const idl = (await Program.fetchIdl(STAKING_ADDRESS, provider))!;

  const program = new Program(idl, provider);

  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
    STAKING_ADDRESS
  );

  const transaction = new Transaction();
  const from_account = await getAssociatedTokenAddress(
    WORMHOLE_MINT_ACCOUNT,
    provider.wallet.publicKey,
    true
  );

  const toAccount = (
    PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        stakeAccountAddress.toBuffer(),
      ],
      program.programId
    )
  )[0];

  const ix = createTransferInstruction(
    from_account,
    toAccount,
    provider.wallet.publicKey,
    101
  );

  transaction.add(ix);

  const tx = await provider.sendAndConfirm(transaction, [], {
    skipPreflight: true,
  });
}

main();

