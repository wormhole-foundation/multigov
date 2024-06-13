import * as anchor from "@coral-xyz/anchor";
import { parseIdlErrors, Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
  TOKEN_PROGRAM_ID,
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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

  let voterAccount: PublicKey;
  let errMap: Map<number, string>;

  let provider: anchor.AnchorProvider;

  const stakeAccountSecret = new Keypair();
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  let EPOCH_DURATION: BN;

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
      makeDefaultConfig(whMintAccount.publicKey)
    ));
    program = stakeConnection.program;
    provider = stakeConnection.provider;
    userAta = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      whMintAccount.publicKey,
      provider.wallet.publicKey,
      true
    );

    errMap = parseIdlErrors(program.idl);
    EPOCH_DURATION = stakeConnection.config.epochDuration;
  });

  it("creates staking account", async () => {
    const owner = provider.wallet.publicKey;

    const [metadataAccount, metadataBump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode(
          wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()
        ),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [custodyAccount, custodyBump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [authorityAccount, authorityBump] =
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
          stakeAccountSecret.publicKey.toBuffer(),
        ],
        program.programId
      );
    let voterBump: number;
    [voterAccount, voterBump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.VOTER_RECORD_SEED()),
        stakeAccountSecret.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .createStakeAccount(owner)
      .signers([stakeAccountSecret])
      .rpc({
        skipPreflight: DEBUG,
      });

    const stake_account_metadata_data =
      await program.account.stakeAccountMetadata.fetch(metadataAccount);

    assert.equal(
      JSON.stringify(stake_account_metadata_data),
      JSON.stringify({
        metadataBump,
        custodyBump,
        authorityBump,
        voterBump,
        owner,
        nextIndex: 0,
        transferEpoch: null,
        signedAgreementHash: null,
      })
    );
  });

  it("deposits tokens", async () => {
    const transaction = new Transaction();
    const from_account = userAta;

    const toAccount = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
          stakeAccountSecret.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    const ix = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      from_account,
      toAccount,
      provider.wallet.publicKey,
      [],
      101
    );
    transaction.add(ix);

    const tx = await provider.sendAndConfirm(transaction, [], {
      skipPreflight: DEBUG,
    });
  });
});
