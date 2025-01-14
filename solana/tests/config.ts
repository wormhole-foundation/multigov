import { AnchorError, parseIdlErrors, utils, Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  startValidator,
  readAnchorConfig,
  getPortNumber,
  ANCHOR_CONFIG_PATH,
  requestWHTokenAirdrop,
} from "./utils/before";
import { createMint, expectFail } from "./utils/utils";
import assert from "assert";
import path from "path";
import * as wasm from "@wormhole/staking-wasm";
import {
  StakeConnection,
  TEST_CHECKPOINTS_ACCOUNT_LIMIT,
  WH_TOKEN_DECIMALS,
  WHTokenBalance,
} from "../app";
import BN from "bn.js";
import {
  HUB_CHAIN_ID,
  hubProposalMetadataUint8Array,
  CORE_BRIDGE_ADDRESS,
} from "../app/constants";
import { StakeAccountMetadata } from "../app/StakeConnection.ts";
import {
  WindowLengthsAccount,
  readWindowLengths,
} from "../app/vote_weight_window_lengths";

// When DEBUG is turned on, we turn preflight transaction checking off
// That way failed transactions show up in the explorer, which makes them
// easier to debug.
const DEBUG = true;
const portNumber = getPortNumber(path.basename(__filename));

describe("config", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const randomUser = new Keypair();
  const zeroPubkey = new PublicKey(0);

  const vestingAdminKeypair = new Keypair();
  const vestingAdmin = vestingAdminKeypair.publicKey;
  const config = readAnchorConfig(ANCHOR_CONFIG_PATH);

  let errMap: Map<number, string>;

  let program;
  let controller;
  let airlockAddress

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

    let tx = new Transaction();
    tx.instructions = [
      SystemProgram.transfer({
        fromPubkey: program.provider.publicKey,
        toPubkey: randomUser.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
      }),
    ];
    await program.provider.sendAndConfirm(tx, [program.provider.wallet.payer]);

    airlockAddress =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(
            wasm.Constants.AIRLOCK_SEED(),
          ),
        ],
        program.programId,
      )[0];

      // Initialize the airlock account
      await program.methods
      .initializeSpokeAirlock()
      .accounts({
        payer: program.provider.wallet.payer,
        airlock: airlockAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([program.provider.wallet.payer])
      .rpc();
  });

  it("initializes config", async () => {
    [configAccount, bump] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
      program.programId,
    );

    await program.methods
      .initConfig({
        governanceAuthority: program.provider.wallet.publicKey,
        votingTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
        maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
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
        maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
        governanceAuthority: program.provider.wallet.publicKey,
        votingTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
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
          votingTokenMint: whMintAccount.publicKey,
          vestingAdmin: vestingAdmin,
          maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
        })
        .rpc();

      await program.methods
        .initConfig({
          governanceAuthority: program.provider.wallet.publicKey,
          votingTokenMint: whMintAccount.publicKey,
          vestingAdmin: vestingAdmin,
          maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
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

  it("should fail to initialize SpokeMetadataCollector if the signer is not a valid governance_authority", async () => {
    try {
      await program.methods
        .initializeSpokeMetadataCollector(
          HUB_CHAIN_ID,
          hubProposalMetadataUint8Array,
        )
        .accounts({ governanceAuthority: randomUser.publicKey })
        .signers([randomUser])
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintAddress");
    }
  });

  it("should successfully initialize SpokeMetadataCollector", async () => {
    const initHubProposalMetadata = new Uint8Array(20);

    await program.methods
      .initializeSpokeMetadataCollector(HUB_CHAIN_ID, initHubProposalMetadata)
      .accounts({ governanceAuthority: program.provider.wallet.publicKey })
      .rpc({ skipPreflight: true });

    const [spokeMetadataCollectorAccount, spokeMetadataCollectorBump] =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(
            wasm.Constants.SPOKE_METADATA_COLLECTOR_SEED(),
          ),
        ],
        program.programId,
      );

    const spokeMetadataCollectorAccountData =
      await program.account.spokeMetadataCollector.fetch(
        spokeMetadataCollectorAccount,
      );

    assert.equal(
      spokeMetadataCollectorAccountData.bump,
      spokeMetadataCollectorBump,
    );
    assert.equal(spokeMetadataCollectorAccountData.hubChainId, HUB_CHAIN_ID);
    assert.equal(
      spokeMetadataCollectorAccountData.hubProposalMetadata.toString(),
      initHubProposalMetadata.toString(),
    );
    assert.equal(
      spokeMetadataCollectorAccountData.wormholeCore.toString("hex"),
      CORE_BRIDGE_ADDRESS.toString("hex"),
    );
  });

  it("should fail to initialize VoteWeightWindowLengths if the signer is not a valid governance_authority", async () => {
    try {
      await program.methods
        .initializeVoteWeightWindowLengths(new BN(850))
        .accounts({ governanceAuthority: randomUser.publicKey })
        .signers([randomUser])
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintAddress");
    }
  });

  it("should fail to initialize VoteWeightWindowLengths if the maximum allowable voice weight window length is exceeded", async () => {
    try {
      await program.methods
        .initializeVoteWeightWindowLengths(new BN(851))
        .accounts({ governanceAuthority: program.provider.wallet.publicKey })
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ExceedsMaxAllowableVoteWeightWindowLength",
      );
    }
  });

  it("should successfully initialize VoteWeightWindowLengths", async () => {
    await program.methods
      .initializeVoteWeightWindowLengths(new BN(850))
      .accounts({ governanceAuthority: program.provider.wallet.publicKey })
      .rpc({ skipPreflight: true });

    const [voteWeightWindowLengthsAccountAddress, voteWeightWindowLengthsBump] =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(
            wasm.Constants.VOTE_WEIGHT_WINDOW_LENGTHS_SEED(),
          ),
        ],
        program.programId,
      );

    let windowLengths: WindowLengthsAccount = await readWindowLengths(
      program.provider.connection,
      voteWeightWindowLengthsAccountAddress,
    );
    assert.equal(windowLengths.getWindowLengthCount(), 1);
    assert.equal(windowLengths.voteWeightWindowLengths.nextIndex, 1);
    assert.equal(windowLengths.getLastWindowLength().value.toString(), "850");
  });

  it("should fail to update HubProposalMetadata if the signer is not a valid governance_authority", async () => {
    try {
      await program.methods
        .updateHubProposalMetadata(hubProposalMetadataUint8Array)
        .accounts({ payer: randomUser.publicKey, airlock: airlockAddress})
        .signers([randomUser])
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "NotGovernanceAuthority");
    }
  });

  it("should successfully update HubProposalMetadata", async () => {
    await program.methods
      .updateHubProposalMetadata(hubProposalMetadataUint8Array)
      .accounts({ payer: program.provider.wallet.publicKey, airlock: airlockAddress })
      .rpc({ skipPreflight: true });

    const [spokeMetadataCollectorAccount, spokeMetadataCollectorBump] =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(
            wasm.Constants.SPOKE_METADATA_COLLECTOR_SEED(),
          ),
        ],
        program.programId,
      );

    const spokeMetadataCollectorAccountData =
      await program.account.spokeMetadataCollector.fetch(
        spokeMetadataCollectorAccount,
      );

    assert.equal(
      spokeMetadataCollectorAccountData.bump,
      spokeMetadataCollectorBump,
    );
    assert.equal(spokeMetadataCollectorAccountData.hubChainId, HUB_CHAIN_ID);
    assert.equal(
      spokeMetadataCollectorAccountData.hubProposalMetadata.toString(),
      hubProposalMetadataUint8Array.toString(),
    );
    assert.equal(
      spokeMetadataCollectorAccountData.wormholeCore.toString("hex"),
      CORE_BRIDGE_ADDRESS.toString("hex"),
    );
  });

  it("should revoke admin rights for updating HubProposalMetadata", async () => {
    await program.methods
      .relinquishAdminControlOverHubProposalMetadata()
      .accounts({ governanceAuthority: program.provider.wallet.publicKey })
      .rpc({ skipPreflight: true });

    const [spokeMetadataCollectorAccount, spokeMetadataCollectorBump] =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(
            wasm.Constants.SPOKE_METADATA_COLLECTOR_SEED(),
          ),
        ],
        program.programId,
      );

    const spokeMetadataCollectorAccountData =
      await program.account.spokeMetadataCollector.fetch(
        spokeMetadataCollectorAccount,
      );

    assert.equal(
      spokeMetadataCollectorAccountData.updatesControlledByGovernance,
      false,
    );

    try {
      await program.methods
        .updateHubProposalMetadata(hubProposalMetadataUint8Array)
        .accounts({ payer: randomUser.publicKey, airlock: airlockAddress})
        .signers([randomUser])
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "AirlockNotSigner");
    }
  });

  it("create account", async () => {
    const configAccountData =
      await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
        governanceAuthority: program.provider.wallet.publicKey,
        votingTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
      }),
    );

    await program.methods
      .createStakeAccount()
      .accounts({
        mint: whMintAccount.publicKey,
        payer: randomUser.publicKey,
      })
      .signers([randomUser])
      .rpc({ skipPreflight: true });

    const metadataAddress = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()),
        randomUser.publicKey.toBuffer(),
      ],
      program.programId,
    )[0];
    const stakeAccountMetadata: StakeAccountMetadata =
      await program.account.stakeAccountMetadata.fetch(metadataAddress);

    assert(
      stakeAccountMetadata.owner.toString("hex") ==
        randomUser.publicKey.toString("hex"),
    );
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
      samConnection.program.methods.updateGovernanceAuthority().accounts({
        newAuthority: new PublicKey(0),
      }),
      "An address constraint was violated",
      errMap,
    );
  });

  it("updates vesting admin", async () => {
    // governance authority can't update vesting admin
    await expectFail(
      program.methods.updateVestingAdmin().accounts({
        newVestingAdmin: program.provider.wallet.publicKey,
      }),
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
      .updateVestingAdmin()
      .accounts({ newVestingAdmin: program.provider.wallet.publicKey })
      .rpc({ skipPreflight: true });
    await vestingAdminConnection.program.methods
      .claimVestingAdmin()
      .accounts({ newVestingAdmin: program.provider.wallet.publicKey })
      .signers([program.provider.wallet])
      .rpc({ skipPreflight: true });

    let configAccountData =
      await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
        governanceAuthority: program.provider.wallet.publicKey,
        votingTokenMint: whMintAccount.publicKey,
        vestingAdmin: program.provider.wallet.publicKey,
      }),
    );

    // the authority gets returned to the original vesting admin
    await program.methods
      .updateVestingAdmin()
      .accounts({ newVestingAdmin: vestingAdmin })
      .rpc();
    await program.methods
      .claimVestingAdmin()
      .accounts({ newVestingAdmin: vestingAdmin })
      .signers([vestingAdminKeypair])
      .rpc();

    configAccountData = await program.account.globalConfig.fetch(configAccount);

    assert.equal(
      JSON.stringify(configAccountData),
      JSON.stringify({
        bump,
        maxCheckpointsAccountLimit: TEST_CHECKPOINTS_ACCOUNT_LIMIT,
        governanceAuthority: program.provider.wallet.publicKey,
        votingTokenMint: whMintAccount.publicKey,
        vestingAdmin: vestingAdmin,
      }),
    );
  });
});
