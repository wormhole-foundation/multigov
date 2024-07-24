import { parseIdlErrors, utils, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
import {
  startValidator,
  readAnchorConfig,
  getPortNumber,
  ANCHOR_CONFIG_PATH,
  requestWHTokenAirdrop,
  getDummyAgreementHash,
  getDummyAgreementHash2,
} from "./utils/before";
import { expectFail, createMint } from "./utils/utils";
import BN from "bn.js";
import assert from "assert";
import path from "path";
import * as wasm from "@wormhole/staking-wasm";
import { WH_TOKEN_DECIMALS, WHTokenBalance, StakeConnection } from "../app";

// When DEBUG is turned on, we turn preflight transaction checking off
// That way failed transactions show up in the explorer, which makes them
// easier to debug.
const DEBUG = true;
const portNumber = getPortNumber(path.basename(__filename));

describe("config", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const zeroPubkey = new PublicKey(0);

  const pdaAuthorityKeypair = new Keypair();
  const config = readAnchorConfig(ANCHOR_CONFIG_PATH);
  const pdaAuthority = pdaAuthorityKeypair.publicKey;

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
      WH_TOKEN_DECIMALS
    );
  });

  it("initializes config", async () => {
    [configAccount, bump] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
      program.programId
    );

    await program.methods
      .initConfig({
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        freeze: false,
        pdaAuthority: pdaAuthority,
        agreementHash: getDummyAgreementHash(),
        mockClockTime: new BN(10),
      })
      .rpc({
        skipPreflight: DEBUG,
      });

    await requestWHTokenAirdrop(
      program.provider.wallet.publicKey,
      whMintAccount.publicKey,
      whMintAuthority,
      WHTokenBalance.fromString("100"),
      program.provider.connection
    );

    const configAccountData = await program.account.globalConfig.fetch(
      configAccount
    );

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        freeze: false,
        pdaAuthority: pdaAuthority,
        agreementHash: getDummyAgreementHash(),
        mockClockTime: new BN(10),
      })
    );
  });

  it("create account", async () => {
    const configAccountData = await program.account.globalConfig.fetch(
      configAccount
    );

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        freeze: false,
        pdaAuthority: pdaAuthority,
        agreementHash: getDummyAgreementHash(),
        mockClockTime: new BN(10),
      })
    );

    const owner = program.provider.wallet.publicKey;
    const stakeAccountKeypair = new Keypair();
    const instructions: TransactionInstruction[] = [];

    instructions.push(
      await program.account.checkpointData.createInstruction(
        stakeAccountKeypair,
        wasm.Constants.CHECKPOINT_DATA_SIZE()
      )
    );

    await program.methods
      .createStakeAccount(owner)
      .preInstructions(instructions)
      .accounts({
        stakeAccountCheckpoints: stakeAccountKeypair.publicKey,
        mint: whMintAccount.publicKey,
      })
      .signers([stakeAccountKeypair])
      .rpc();

    stakeAccountAddress = stakeAccountKeypair.publicKey;
  });

  it("someone else tries to access admin methods", async () => {
    const sam = new Keypair();
    const samConnection = await StakeConnection.createStakeConnection(
      program.provider.connection,
      new Wallet(sam),
      program.programId
    );

    await samConnection.program.provider.connection.requestAirdrop(
      sam.publicKey,
      1_000_000_000_000
    );

    // Airdrops are not instant unfortunately, wait
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await expectFail(
      samConnection.program.methods.updateGovernanceAuthority(new PublicKey(0)),
      "An address constraint was violated",
      errMap
    );

    await expectFail(
      samConnection.program.methods.updateAgreementHash(
        Array.from(Buffer.alloc(32))
      ),
      "An address constraint was violated",
      errMap
    );
  });

  it("updates pda authority", async () => {
    // governance authority can't update pda authority
    await expectFail(
      program.methods.updatePdaAuthority(program.provider.wallet.publicKey),
      "An address constraint was violated",
      errMap
    );

    const pdaConnection = await StakeConnection.createStakeConnection(
      program.provider.connection,
      new Wallet(pdaAuthorityKeypair),
      program.programId
    );

    await pdaConnection.program.provider.connection.requestAirdrop(
      pdaAuthorityKeypair.publicKey,
      1_000_000_000_000
    );

    // Airdrops are not instant unfortunately, wait
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // pda_authority updates pda_authority to the holder of governance_authority
    await pdaConnection.program.methods
      .updatePdaAuthority(program.provider.wallet.publicKey)
      .rpc();

    let configAccountData = await program.account.globalConfig.fetch(
      configAccount
    );

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        freeze: false,
        pdaAuthority: program.provider.wallet.publicKey,
        agreementHash: getDummyAgreementHash(),
        mockClockTime: new BN(10),
      })
    );

    // the authority gets returned to the original pda_authority
    await program.methods.updatePdaAuthority(pdaAuthority).rpc();

    configAccountData = await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        freeze: false,
        pdaAuthority: pdaAuthority,
        agreementHash: getDummyAgreementHash(),
        mockClockTime: new BN(10),
      })
    );
  });

  it("updates agreement hash", async () => {
    assert.notEqual(
      JSON.stringify(getDummyAgreementHash()),
      JSON.stringify(getDummyAgreementHash2())
    );

    await program.methods.updateAgreementHash(getDummyAgreementHash2()).rpc();

    let configAccountData = await program.account.globalConfig.fetch(
      configAccount
    );
    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        governanceAuthority: program.provider.wallet.publicKey,
        whTokenMint: whMintAccount.publicKey,
        freeze: false,
        pdaAuthority: pdaAuthority,
        agreementHash: getDummyAgreementHash2(),
        mockClockTime: new BN(10),
      })
    );
  });
});
