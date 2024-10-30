import * as anchor from "@coral-xyz/anchor";
import { parseIdlErrors, Program, utils } from "@coral-xyz/anchor";
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
      ],
      program.programId,
    )[0];

    const [metadataAccount, metadataBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(
          wasm.Constants.STAKE_ACCOUNT_METADATA_SEED(),
        ),
        checkpointDataAddress.toBuffer(),
      ],
      program.programId,
    );

    const [custodyAccount, custodyBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        checkpointDataAddress.toBuffer(),
      ],
      program.programId,
    );

    const [authorityAccount, authorityBump] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
        checkpointDataAddress.toBuffer(),
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
        delegate: checkpointDataAddress,
      }),
    );
  });

  it("deposits tokens", async () => {
    const transaction = new Transaction();
    const from_account = userAta;

    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )[0];

    const toAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        checkpointDataAddress.toBuffer(),
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
    const toAccount = userAta;

    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )[0];

    await program.methods
      .withdrawTokens(new BN(1))
      .accounts({
        currentDelegateStakeAccountCheckpoints: checkpointDataAddress,
        stakeAccountCheckpoints: checkpointDataAddress,
        destination: toAccount,
      })
      .rpc({ skipPreflight: DEBUG });
  });
});
