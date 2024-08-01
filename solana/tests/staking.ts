import * as anchor from "@coral-xyz/anchor";
import { parseIdlErrors, Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { expectFail } from "./utils/utils";
import BN from "bn.js";
import assert from "assert";
import * as wasm from "@wormhole/staking-wasm";
import path from "path";
import {
  readAnchorConfig,
  ANCHOR_CONFIG_PATH,
  standardSetup,
  getPortNumber,
  makeDefaultConfig,
  CustomAbortController,
  getDummyAgreementHash,
} from "./utils/before";
import { StakeConnection, WHTokenBalance } from "../app";

// When DEBUG is turned on, we turn preflight transaction checking off
// That way failed transactions show up in the explorer, which makes them
// easier to debug.
const DEBUG = true;
const portNumber = getPortNumber(path.basename(__filename));

describe("staking", async () => {
  let program: Program<Staking>;

  let errMap: Map<number, string>;

  let provider: anchor.AnchorProvider;

  const stakeAccountSecret = new Keypair();
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const zeroPubkey = new PublicKey(0);

  let userAta: PublicKey;
  const config = readAnchorConfig(ANCHOR_CONFIG_PATH);

  let controller: CustomAbortController;
  let stakeConnection: StakeConnection;

  after(async () => {
    controller.abort();
  });
  before(async () => {
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      config,
      whMintAccount,
      whMintAuthority,
      makeDefaultConfig(whMintAccount.publicKey),
    ));
    program = stakeConnection.program;
    provider = stakeConnection.provider;

    userAta = await getAssociatedTokenAddress(
      whMintAccount.publicKey,
      provider.wallet.publicKey,
      true,
    );

    errMap = parseIdlErrors(program.idl);
  });

  it("creates staking account", async () => {
    const owner = provider.wallet.publicKey;

    const [metadataAccount, metadataBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(
          wasm.Constants.STAKE_ACCOUNT_METADATA_SEED(),
        ),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const [custodyAccount, custodyBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const [authorityAccount, authorityBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const tx = await program.methods
      .createStakeAccount(owner)
      .preInstructions([
        await program.account.checkpointData.createInstruction(
          stakeAccountSecret,
          wasm.Constants.CHECKPOINT_DATA_SIZE(),
        ),
      ])
      .accounts({
        stakeAccountCheckpoints: stakeAccountSecret.publicKey,
        mint: whMintAccount.publicKey,
      })
      .signers([stakeAccountSecret])
      .rpc({
        skipPreflight: DEBUG,
      });

    const stake_account_metadata_data =
      await program.account.stakeAccountMetadata.fetch(metadataAccount);

    const expectedRecordedBalance = (0).toString(16).padStart(2, "0");

    assert.equal(
      JSON.stringify(stake_account_metadata_data),
      JSON.stringify({
        metadataBump,
        custodyBump,
        authorityBump,
        owner,
        delegate: zeroPubkey,
        recordedBalance: expectedRecordedBalance,
        signedAgreementHash: null,
      }),
    );
  });

  it("deposits tokens", async () => {
    const transaction = new Transaction();
    const from_account = userAta;

    const toAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId,
    )[0];

    const ix = createTransferInstruction(
      from_account,
      toAccount,
      provider.wallet.publicKey,
      101,
    );
    transaction.add(ix);

    const tx = await provider.sendAndConfirm(transaction, [], {
      skipPreflight: DEBUG,
    });
  });

  it("withdraws tokens", async () => {
    const toAccount = userAta;

    await program.methods
      .withdrawTokens(new BN(1))
      .accounts({
        currentDelegateStakeAccountCheckpoints: stakeAccountSecret.publicKey,
        stakeAccountCheckpoints: stakeAccountSecret.publicKey,
        destination: toAccount,
      })
      .rpc({ skipPreflight: DEBUG });
  });
});
