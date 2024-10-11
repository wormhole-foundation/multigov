import { parseIdlErrors, utils, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
import {
  startValidator,
  readAnchorConfig,
  getPortNumber,
  ANCHOR_CONFIG_PATH,
  requestWHTokenAirdrop,
  getDummyAgreementHash,
} from "./utils/before";
import { expectFail, createMint } from "./utils/utils";
import assert from "assert";
import path from "path";
import * as wasm from "@wormhole/staking-wasm";
import { WH_TOKEN_DECIMALS, WHTokenBalance, StakeConnection } from "../app";
import * as console from "node:console";
import BN from "bn.js";

// When DEBUG is turned on, we turn preflight transaction checking off
// That way failed transactions show up in the explorer, which makes them
// easier to debug.
const DEBUG = true;
const portNumber = getPortNumber(path.basename(__filename));

describe("config", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const zeroPubkey = new PublicKey(0);

  const vestingAdminKeypair = new Keypair();
  const vestingAdmin = vestingAdminKeypair.publicKey;
  const config = readAnchorConfig(ANCHOR_CONFIG_PATH);

  let errMap: Map<number, string>;

  let program;
  let controller;

  let stakeAccountAddress;

  let configAccount: PublicKey;
  let bump: number;

  after(async () => {
    controller.abort();
  });

  before(async () => {
    ({ controller, program } = await startValidator(portNumber, config));
    errMap = parseIdlErrors(program.idl);

    await createMint(
      program.provider,
      whMintAccount,
      whMintAuthority.publicKey,
      null,
      WH_TOKEN_DECIMALS,
    );
  });

  it("initializes config", async () => {
    [configAccount, bump] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
      program.programId,
    );

    await program.methods
      .initConfig({
        freeze: false,
        mockClockTime: new BN(0),
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
      })
      .rpc({
        skipPreflight: DEBUG,
      });

    await requestWHTokenAirdrop(
      program.provider.wallet.publicKey,
      whMintAccount.publicKey,
      whMintAuthority,
      WHTokenBalance.fromString("100"),
      program.provider.connection,
    );

    const configAccountData =
      await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        freeze: false,
        mockClockTime: new BN(0),
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
        agreementHash: getDummyAgreementHash(),
      }),
    );
  });

  it("fails on re-initialization of config", async () => {
    [configAccount, bump] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
      program.programId,
    );

    try {
      await program.methods
        .initConfig({
          governanceAuthority: program.provider.wallet.publicKey,
          whTokenMint: whMintAccount.publicKey,
          freeze: false,
          vestingAdmin: vestingAdmin,
          agreementHash: getDummyAgreementHash(),
          mockClockTime: new BN(0),
        })
        .rpc();

      await program.methods
        .initConfig({
          governanceAuthority: program.provider.wallet.publicKey,
          whTokenMint: whMintAccount.publicKey,
          freeze: false,
          vestingAdmin: vestingAdmin,
          agreementHash: getDummyAgreementHash(),
          mockClockTime: new BN(0),
        })
        .rpc();

      assert.fail("Re-initialization should fail");
    } catch (e) {
      assert(
        e.transactionMessage.includes(
          "Error processing Instruction 0: custom program error: 0x0",
        ),
      );

      const expectedLogMessage = `Allocate: account Address { address: ${configAccount.toString()}, base: None } already in use`;
      assert(e.transactionLogs.find((log) => log.includes(expectedLogMessage)));
    }
  });

  it("create account", async () => {
    const configAccountData =
      await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        freeze: false,
        mockClockTime: new BN(0),
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
        agreementHash: getDummyAgreementHash(),
      }),
    );

    const owner = program.provider.wallet.publicKey;
    const stakeAccountKeypair = new Keypair();

    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        owner.toBuffer(),
      ],
      program.programId,
    )[0];

    await program.methods
      .createStakeAccount(owner)
      .accounts({
        stakeAccountCheckpoints: checkpointDataAddress,
        mint: whMintAccount.publicKey,
      })
      .rpc();

    stakeAccountAddress = stakeAccountKeypair.publicKey;
  });

  it("someone else tries to access admin methods", async () => {
    const sam = new Keypair();
    const samConnection = await StakeConnection.createStakeConnection(
      program.provider.connection,
      new Wallet(sam),
      program.programId,
    );

    await samConnection.program.provider.connection.requestAirdrop(
      sam.publicKey,
      1_000_000_000_000,
    );

    // Airdrops are not instant unfortunately, wait
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await expectFail(
      samConnection.program.methods.updateGovernanceAuthority(new PublicKey(0)),
      "An address constraint was violated",
      errMap,
    );
  });

  it("updates vesting admin", async () => {
    // governance authority can't update vesting admin
    await expectFail(
      program.methods.updateVestingAdmin(program.provider.wallet.publicKey),
      "An address constraint was violated",
      errMap,
    );

    const vestingAdminConnection = await StakeConnection.createStakeConnection(
      program.provider.connection,
      new Wallet(vestingAdminKeypair),
      program.programId,
    );

    await vestingAdminConnection.program.provider.connection.requestAirdrop(
      vestingAdminKeypair.publicKey,
      1_000_000_000_000,
    );

    // Airdrops are not instant unfortunately, wait
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await vestingAdminConnection.program.methods
      .updateVestingAdmin(program.provider.wallet.publicKey)
      .rpc();

    let configAccountData =
      await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        freeze: false,
        mockClockTime: new BN(0),
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        vestingAdmin: program.provider.wallet.publicKey,
        agreementHash: getDummyAgreementHash(),
      }),
    );

    // the authority gets returned to the original vesting admin
    await program.methods.updateVestingAdmin(vestingAdmin).rpc();

    configAccountData = await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        freeze: false,
        mockClockTime: new BN(0),
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
        agreementHash: getDummyAgreementHash(),
      }),
    );
  });
});
