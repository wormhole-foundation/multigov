import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as wasm from "@wormhole/staking-wasm";

function getConfigAccount(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
    programId,
  )[0];
}

export async function initAddressLookupTable(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  stakingPID: PublicKey,
) {
  const configAccount = getConfigAccount(stakingPID);

  const [loookupTableInstruction, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: provider.publicKey,
      payer: provider.publicKey,
      recentSlot: await provider.connection.getSlot(),
    });
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: provider.publicKey,
    authority: provider.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [
      ComputeBudgetProgram.programId,
      SystemProgram.programId,
      stakingPID,
      mint,
      configAccount,
      SYSVAR_RENT_PUBKEY,
      TOKEN_PROGRAM_ID,
    ],
  });
  const createLookupTableTx = new VersionedTransaction(
    new TransactionMessage({
      instructions: [loookupTableInstruction, extendInstruction],
      payerKey: provider.publicKey,
      recentBlockhash: (await provider.connection.getLatestBlockhash())
        .blockhash,
    }).compileToV0Message(),
  );
  await provider.sendAndConfirm(createLookupTableTx, [], {
    skipPreflight: true,
  });
  return lookupTableAddress;
}
