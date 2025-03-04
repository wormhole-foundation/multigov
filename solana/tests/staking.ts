import * as anchor from "@coral-xyz/anchor";
import { parseIdlErrors, Program, utils } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import assert from "assert";
import * as wasm from "@wormhole/staking-wasm";
import path from "path";
import {
  ANCHOR_CONFIG_PATH,
  CustomAbortController,
  getPortNumber,
  makeDefaultConfig,
  readAnchorConfig,
  standardSetup,
} from "./utils/before";
import { StakeConnection } from "../app"; // When DEBUG is turned on, we turn preflight transaction checking off

// When DEBUG is turned on, we turn preflight transaction checking off
// That way failed transactions show up in the explorer, which makes them
// easier to debug.
const DEBUG = true;
const portNumber = getPortNumber(path.basename(__filename));

describe("staking", async () => {
  let program: Program<Staking>;

  let errMap: Map<number, string>;

  let provider: anchor.AnchorProvider;

  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();

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
      governanceAuthority,
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

    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        owner.toBuffer(),
        Buffer.from([0]),
      ],
      program.programId,
    )[0];

    const [metadataAccount, metadataBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(
          wasm.Constants.STAKE_ACCOUNT_METADATA_SEED(),
        ),
        owner.toBuffer(),
      ],
      program.programId,
    );

    const [custodyAccount, custodyBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        owner.toBuffer(),
      ],
      program.programId,
    );

    const [authorityAccount, authorityBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
        owner.toBuffer(),
      ],
      program.programId,
    );

    await program.methods
      .createStakeAccount()
      .accounts({
        mint: whMintAccount.publicKey,
      })
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
        recordedBalance: expectedRecordedBalance,
        recordedVestingBalance: expectedRecordedBalance,
        owner,
        delegate: owner,
        stakeAccountCheckpointsLastIndex: 0,
      }),
    );
  });

  it("deposits tokens", async () => {
    const transaction = new Transaction();
    const from_account = userAta;

    const toAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        provider.wallet.publicKey.toBuffer(),
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

    await provider.sendAndConfirm(transaction, [], {
      skipPreflight: DEBUG,
    });
  });

  it("withdraws tokens", async () => {
    const owner = provider.wallet.publicKey;
    const toAccount = userAta;

    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        owner.toBuffer(),
        Buffer.from([0, 0]),
      ],
      program.programId,
    )[0];

    const currentDelegateStakeAccountMetadataOwner = owner;
    const stakeAccountMetadataOwner = owner;

    await program.methods
      .withdrawTokens(
        new BN(1),
        currentDelegateStakeAccountMetadataOwner,
        stakeAccountMetadataOwner,
      )
      .accounts({
        currentDelegateStakeAccountCheckpoints: checkpointDataAddress,
        destination: toAccount,
      })
      .rpc({ skipPreflight: DEBUG });
  });
});
