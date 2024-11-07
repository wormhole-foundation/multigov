import BN from "bn.js";
import { randomBytes } from "crypto";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import assert from "assert";
import {
  ANCHOR_CONFIG_PATH,
  getPortNumber,
  makeTestConfig,
  newUserStakeConnection,
  readAnchorConfig,
  standardSetup,
  sleep,
} from "./utils/before";
import path from "path";
import { AnchorError, utils } from "@coral-xyz/anchor";
import { StakeConnection, WHTokenBalance } from "../app";
import { StakeAccountMetadata } from "../app/StakeConnection";
import { CheckpointAccount } from "../app/checkpoints";
import * as wasm from "@wormhole/staking-wasm";

const portNumber = getPortNumber(path.basename(__filename));

describe("vesting, () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();
  const fakeVestingAdmin = new Keypair();

  const confirm = async (signature: string): Promise<string> => {
    const block =
      await stakeConnection.provider.connection.getLatestBlockhash();
    await stakeConnection.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  };

  let stakeConnection: StakeConnection;
  let controller;

  const NOW = new BN(Math.floor(new Date().getTime() / 1000));
  const FEW_LATER = NOW.add(new BN(1));
  const FEW_LATER_2 = NOW.add(new BN(2));
  const LATER = NOW.add(new BN(1000));
  const EVEN_LATER = LATER.add(new BN(1000));
  const EVEN_LATER_AGAIN = EVEN_LATER.add(new BN(1000));

  const TINY_CHECKPOINTS_ACCOUNT_LIMIT = 4;

  const vester = Keypair.generate();
  const newVester = Keypair.generate();
  const vesterWithoutAccount = Keypair.generate();
  const seed = new BN(randomBytes(8));

  let accounts,
    config,
    vault,
    vesterTa,
    newVesterTa,
    vesterTaWithoutAccount,
    adminAta,
    vestNow,
    vestEvenLater,
    vestLater,
    vestLaterForTransfer,
    vestEvenLaterAgain,
    vestNowForTransfer,
    vestingBalance,
    vestFewLater,
    vesterStakeConnection,
    newVestingBalance,
    vestingBalanceWithoutAccount,
    newVesterStakeConnection;

  let fakeAccounts,
    fakeMintAccount,
    fakeConfig,
    fakeAdminAta,
    fakeVault,
    fakeVesterTa,
    fakeVestNow,
    fakeVestingBalanceAccount;

  after(async () => {
    controller.abort();
  });

  before(async () => {
    const anchorConfig = readAnchorConfig(ANCHOR_CONFIG_PATH);
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      governanceAuthority,
      makeTestConfig(
        whMintAccount.publicKey,
        whMintAuthority.publicKey,
        TINY_CHECKPOINTS_ACCOUNT_LIMIT,
      ),
      WHTokenBalance.fromString("1000"),
    ));

    config = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
        whMintAuthority.publicKey.toBuffer(),
        whMintAccount.publicKey.toBuffer(),
        seed.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vault = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      config,
      true,
      TOKEN_PROGRAM_ID,
    );
    vesterTa = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      vester.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    newVesterTa = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      newVester.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    vesterTaWithoutAccount = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      vesterWithoutAccount.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    adminAta = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      whMintAuthority.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    vestNow = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vesterTa.toBuffer(),
        NOW.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestFewLater = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        vesterTa.toBuffer(),
        FEW_LATER_2.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestLater = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vesterTa.toBuffer(),
        LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestEvenLater = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vesterTa.toBuffer(),
        EVEN_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestLaterForTransfer = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestEvenLaterAgain = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vesterTa.toBuffer(),
        EVEN_LATER_AGAIN.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestNowForTransfer = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        vesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestingBalance = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vester.publicKey.toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];

    newVestingBalance = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        newVester.publicKey.toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];

    vestingBalanceWithoutAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vesterWithoutAccount.publicKey.toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];

    vesterStakeConnection = await newUserStakeConnection(
      stakeConnection,
      vester,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );

    newVesterStakeConnection = await newUserStakeConnection(
      stakeConnection,
      newVester,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );

    await stakeConnection.createStakeAccount();
    await vesterStakeConnection.createStakeAccount();
    await newVesterStakeConnection.createStakeAccount();

    accounts = {
      admin: whMintAuthority.publicKey,
      payer: whMintAuthority.publicKey,
      mint: whMintAccount.publicKey,
      config,
      vault,
      vester: vester.publicKey,
      vesterTa,
      newVesterTa,
      adminAta,
      recovery: adminAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      vestingBalance: vestingBalance,
    };
  });

  it("Airdrop", async () => {
    let tx = new Transaction();
    tx.instructions = [
      ...[whMintAuthority, vester, fakeVestingAdmin].map((k) =>
        SystemProgram.transfer({
          fromPubkey: stakeConnection.provider.publicKey,
          toPubkey: k.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        }),
      ),
    ];
    await stakeConnection.provider.sendAndConfirm(tx, [
      stakeConnection.provider.wallet.payer,
    ]);

    tx = new Transaction();
    tx.instructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        whMintAuthority.publicKey,
        adminAta,
        whMintAuthority.publicKey,
        whMintAccount.publicKey,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        whMintAuthority.publicKey,
        vesterTa,
        vester.publicKey,
        whMintAccount.publicKey,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        whMintAuthority.publicKey,
        newVesterTa,
        newVester.publicKey,
        whMintAccount.publicKey,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        whMintAuthority.publicKey,
        vesterTaWithoutAccount,
        vesterWithoutAccount.publicKey,
        whMintAccount.publicKey,
      ),
      createMintToInstruction(
        whMintAccount.publicKey,
        adminAta,
        whMintAuthority.publicKey,
        1e11,
      ),
    ];
    await stakeConnection.provider.sendAndConfirm(tx, [whMintAuthority]);
  });

  it("should fail to initialize vesting config with invalid admin", async () => {
    try {
      await stakeConnection.program.methods
        .initializeVestingConfig(seed)
        .accounts({
          ...accounts,
          admin: fakeVestingAdmin.publicKey,
        })
        .signers([fakeVestingAdmin])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
    }

    try {
      await stakeConnection.program.methods
        .initializeVestingConfig(seed)
        .accounts({
          admin: fakeVestingAdmin.publicKey,
          mint: whMintAccount.publicKey,
          recovery: adminAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          vestingBalance: vestingBalance,
        })
        .signers([fakeVestingAdmin])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingAdmin",
      );
    }
  });

  it("Initialize config", async () => {
    await stakeConnection.program.methods
      .initializeVestingConfig(seed)
      .accounts({ ...accounts })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
  });

  it("should fail to create vesting balance with invalid admin", async () => {
    try {
      await stakeConnection.program.methods
        .createVestingBalance()
        .accounts({
          ...accounts,
          vestingBalance: vestingBalance,
          admin: fakeVestingAdmin.publicKey,
        })
        .signers([fakeVestingAdmin])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
    }

    fakeConfig = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
        fakeVestingAdmin.publicKey.toBuffer(),
        whMintAccount.publicKey.toBuffer(),
        seed.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    try {
      await stakeConnection.program.methods
        .createVestingBalance()
        .accounts({
          ...accounts,
          vestingBalance: vestingBalance,
          admin: fakeVestingAdmin.publicKey,
          config: fakeConfig,
        })
        .signers([fakeVestingAdmin])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "AccountNotInitialized",
      );
    }
  });

  it("Create vesting balance", async () => {
    await stakeConnection.program.methods
      .createVestingBalance()
      .accounts({ ...accounts, vestingBalance: vestingBalance })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
  });

  it("Create another vesting balance", async () => {
    await stakeConnection.program.methods
      .createVestingBalance()
      .accounts({
        ...accounts,
        vestingBalance: newVestingBalance,
        vesterTa: newVesterTa,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
  });

  it("should fail to create vest with invalid admin", async () => {
    try {
      await stakeConnection.program.methods
        .createVesting(NOW, new BN(1337e6))
        .accounts({
          ...accounts,
          vest: vestNow,
          admin: fakeVestingAdmin.publicKey,
        })
        .signers([fakeVestingAdmin])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
    }
  });

  it("Create a matured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(NOW, new BN(1337e6))
      .accounts({ ...accounts, vest: vestNow })
      .signers([whMintAuthority])
      .rpc({
        skipPreflight: true,
      })
      .then(confirm);
  });

  it("Create another matured vests", async () => {
    await stakeConnection.program.methods
      .createVesting(FEW_LATER, new BN(1337e6))
      .accounts({ ...accounts, vest: vestNowForTransfer })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
    await stakeConnection.program.methods
      .createVesting(LATER, new BN(1337e6))
      .accounts({
        ...accounts,
        vest: vestLaterForTransfer,
        vesterTa: newVesterTa,
        vestingBalance: newVestingBalance,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
    await stakeConnection.program.methods
      .createVesting(FEW_LATER_2, new BN(1337e6))
      .accounts({ ...accounts, vest: vestFewLater })
      .signers([whMintAuthority])
      .rpc({
        skipPreflight: true,
      })
      .then(confirm);
  });

  it("Create an unmatured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(LATER, new BN(1337e6))
      .accounts({ ...accounts, vest: vestLater })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);
  });

  it("Create another unmatured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(EVEN_LATER, new BN(1337e6))
      .accounts({
        ...accounts,
        vest: vestEvenLater,
        stakeAccountCheckpoints: null,
        stakeAccountMetadata: null,
      })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);
  });

  it("should fail to claim a vest before finalization", async () => {
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: null,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "VestingUnfinalized",
      );
    }
  });

  it("Cancel a vest", async () => {
    await stakeConnection.program.methods
      .cancelVesting()
      .accounts({ ...accounts, vest: vestLater })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);
  });

  it("should fail to finalize vesting when vault token balance is less than vestingConfig.vested", async () => {
    const vaultTokenBalance = (
      await getAccount(stakeConnection.provider.connection, vault)
    ).amount;
    const vestingConfigVested = (
      await stakeConnection.program.account.vestingConfig.fetch(config)
    ).vested;
    assert(
      vaultTokenBalance < vestingConfigVested,
      "In this test, the vault token balance must be less than vestingConfig.vested",
    );

    try {
      await stakeConnection.program.methods
        .finalizeVestingConfig()
        .accounts({ ...accounts })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "VestedBalanceMismatch",
      );
    }
  });

  it("Deposits vesting tokens", async () => {
    const tx = new Transaction();
    tx.add(
      createTransferCheckedInstruction(
        adminAta,
        whMintAccount.publicKey,
        vault,
        whMintAuthority.publicKey,
        1339e7,
        6,
        undefined,
        TOKEN_PROGRAM_ID,
      ),
    );
    await stakeConnection.provider.sendAndConfirm(tx, [whMintAuthority]);
  });

  it("should fail to finalize vesting when vault token balance is greater than vestingConfig.vested", async () => {
    const vaultTokenBalance = (
      await getAccount(stakeConnection.provider.connection, vault)
    ).amount;
    const vestingConfigVested = (
      await stakeConnection.program.account.vestingConfig.fetch(config)
    ).vested;
    assert(
      vaultTokenBalance > vestingConfigVested,
      "In this test, the vault token balance must be greater than vestingConfig.vested",
    );

    try {
      await stakeConnection.program.methods
        .finalizeVestingConfig()
        .accounts({ ...accounts })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "VestedBalanceMismatch",
      );
    }
  });

  it("should fail to withdraw surplus tokens if the signer is not a valid admin", async () => {
    try {
      await stakeConnection.program.methods
        .withdrawSurplus()
        .accounts({
          ...accounts,
          admin: fakeVestingAdmin.publicKey,
        })
        .signers([fakeVestingAdmin])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
    }
  });

  it("Withdraw surplus tokens", async () => {
    await stakeConnection.program.methods
      .withdrawSurplus()
      .accounts({ ...accounts })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);
  });

  it("Finalizes the vest", async () => {
    await stakeConnection.program.methods
      .finalizeVestingConfig()
      .accounts({ ...accounts })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);
  });

  it("should fail to cancel a vest after finalization", async () => {
    try {
      await stakeConnection.program.methods
        .cancelVesting()
        .accounts({ ...accounts, vest: vestEvenLater })
        .signers([whMintAuthority])
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "VestingFinalized");
    }
  });

  it("should fail to create a vest after finalize", async () => {
    try {
      await stakeConnection.program.methods
        .createVesting(EVEN_LATER_AGAIN, new BN(1337e6))
        .accounts({ ...accounts, vest: vestEvenLaterAgain })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "VestingFinalized");
    }
  });

  it("should fail to claim an unmatured vest", async () => {
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestEvenLater,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: null,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "NotFullyVested");
    }
  });

  it("should successfully delegate with vest", async () => {
    await sleep(4000)
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegateWithVest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config,
      );

    let stakeAccountCheckpointsData =
      await vesterStakeConnection.program.account.checkpointData.fetch(
        stakeAccountCheckpointsAddress,
      );

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        stakeAccountCheckpointsData.owner,
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "5348000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "5348000000",
    );
  });

  it("should fail to delegate with uninitialized vestingBalance account", async () => {
    await sleep(4000)
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegateWithVest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config,
      );

    let delegateeStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let delegateeStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateeStakeAccountMetadataAddress,
        false,
      );

    let currentDelegateStakeAccountOwner = await stakeConnection.delegates(
      stakeAccountCheckpointsAddress,
    );
    let currentDelegateStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        currentDelegateStakeAccountOwner,
      );

    let currentDelegateStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        currentDelegateStakeAccountMetadataAddress,
        false,
      );

    let uninitializedVestingBalanceAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("uninitialized_vesting_balance"),
        config.toBuffer(),
        stakeConnection.userPublicKey().toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];

    let delegateeStakeAccountCheckpointsData =
      await stakeConnection.program.account.checkpointData.fetch(
        delegateeStakeAccountCheckpointsAddress,
      );

    let delegateeStakeAccountOwner = delegateeStakeAccountCheckpointsData.owner;

    try {
      await stakeConnection.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegateStakeAccountOwner)
        .accounts({
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          vestingConfig: config,
          vestingBalance: uninitializedVestingBalanceAccount,
          mint: whMintAccount.publicKey,
        })
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "AccountNotInitialized",
      );
    }
  });

  it("should fail to delegate with vestingBalance account discriminator mismatch", async () => {
    await sleep(4000)
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegateWithVest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config,
      );

    let delegateeStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let delegateeStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateeStakeAccountMetadataAddress,
        false,
      );

    let currentDelegateStakeAccountOwner = await stakeConnection.delegates(
      stakeAccountCheckpointsAddress,
    );
    let currentDelegateStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        currentDelegateStakeAccountOwner,
      );

    let currentDelegateStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        currentDelegateStakeAccountMetadataAddress,
        false,
      );

    let delegateeStakeAccountCheckpointsData =
      await stakeConnection.program.account.checkpointData.fetch(
        delegateeStakeAccountCheckpointsAddress,
      );
    let delegateeStakeAccountOwner = delegateeStakeAccountCheckpointsData.owner;

    try {
      await stakeConnection.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegateStakeAccountOwner)
        .accounts({
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          vestingConfig: config,
          vestingBalance: config,
          mint: whMintAccount.publicKey,
        })
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "AccountDiscriminatorMismatch",
      );
    }
  });

  it("should fail to claim without stakeAccountMetadata", async () => {
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: null,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to claim without stakeAccountCheckpoints", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to claim with incorrect stakeAccountMetadata owner", async () => {
    let incorrectStakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        stakeConnection.userPublicKey(),
      );
    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        incorrectStakeAccountMetadataAddress,
        false,
      );
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: incorrectStakeAccountCheckpointsAddress,
          stakeAccountMetadata: incorrectStakeAccountMetadataAddress,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountOwner",
      );
    }
  });

  it("should fail to claim with incorrect stakeAccountCheckpoints ", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let incorrectStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        stakeConnection.userPublicKey(),
      );

    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        incorrectStakeAccountMetadataAddress,
        false,
      );
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: incorrectStakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountCheckpoints",
      );
    }
  });

  it("fails to create a new checkpoints account if the existing checkpoints account is not fully loaded and is used as input", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let notFulledStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let notFulledStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        notFulledStakeAccountCheckpointsAddress,
      );

    assert(
      notFulledStakeCheckpoints.getCheckpointCount() < TINY_CHECKPOINTS_ACCOUNT_LIMIT,
    );

    try {
      await stakeConnection.program.methods
        .createCheckpoints()
        .accounts({
          payer: accounts.vester,
          stakeAccountCheckpoints: notFulledStakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        e.transactionMessage.includes(
          "Error processing Instruction 0: custom program error: 0x0",
        ),
      );

      const expectedLogMessage = `Allocate: account Address { address: ${notFulledStakeAccountCheckpointsAddress.toString()}, base: None } already in use`;
      assert(e.transactionLogs.find((log) => log.includes(expectedLogMessage)));
    }
  });

  it("should successfully claim staked vest", async () => {
    let stakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataData =
      await stakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let delegateStakeAccountCheckpointsOwner =
      stakeAccountMetadataData.delegate;
    let delegateStakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        delegateStakeAccountCheckpointsOwner,
      );

    let delegateStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateStakeAccountMetadataAddress,
        false,
      );
    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vest: vestNow,
        stakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        delegateStakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "4011000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "4011000000",
    );
  });

  it("should fail to claim if checkpoints account is fulled", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let vesterStakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );
    // there is only one checkpoint account
    assert.equal(
      vesterStakeAccountMetadata.stakeAccountCheckpointsLastIndex,
      0,
    );

    let currentStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    let currentStakeAccountCheckpoints: CheckpointAccount =
    await vesterStakeConnection.fetchCheckpointAccount(
      currentStakeAccountCheckpointsAddress,
    );
    // current checkpoint account not fully filled out
    assert.equal(
      currentStakeAccountCheckpoints.getCheckpointCount(),
      TINY_CHECKPOINTS_ACCOUNT_LIMIT - 2,
    );

    // filling the checkpoint account to the limit
    await sleep(4000)
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );
    await sleep(4000)
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    vesterStakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );
    // a new checkpoint account must be created 
    assert.equal(
      vesterStakeAccountMetadata.stakeAccountCheckpointsLastIndex,
      1,
    );

    currentStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    // current checkpoint account does not exist
    assert.equal(currentStakeAccountCheckpointsAddress, undefined);

    let previousStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    let previousVesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        previousStakeAccountCheckpointsAddress,
      );

    // previous checkpoint account is filled
    assert.equal(
      previousVesterStakeCheckpoints.getCheckpointCount(),
      TINY_CHECKPOINTS_ACCOUNT_LIMIT,
    );

    let stakeAccountMetadataData =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let delegateStakeAccountCheckpointsOwner =
      stakeAccountMetadataData.delegate;
    let delegateStakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        delegateStakeAccountCheckpointsOwner,
      );

    let delegateStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateStakeAccountMetadataAddress,
        true,
      );

    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestFewLater,
          stakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "TooManyCheckpoints",
      );
    }
  });

  it("should fail to delegate if checkpoints account is fulled", async () => {
    let delegateeStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let currentDelegateStakeAccountOwner =
      vesterStakeConnection.userPublicKey();
    let delegateeStakeAccountOwner = vesterStakeConnection.userPublicKey();

    let delegateeStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateeStakeAccountMetadataAddress,
        true,
      );

    let currentDelegateStakeAccountAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        currentDelegateStakeAccountOwner,
      );

    let currentDelegateStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        currentDelegateStakeAccountAddress,
        true,
      );

    let vestingBalanceAccount = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vesterStakeConnection.userPublicKey().toBuffer(),
      ],
      vesterStakeConnection.program.programId,
    )[0];

    try {
      await stakeConnection.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegateStakeAccountOwner)
        .accounts({
          payer: vesterStakeConnection.userPublicKey(),
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          vestingConfig: config,
          vestingBalance: vestingBalanceAccount,
          mint: whMintAccount.publicKey,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "TooManyCheckpoints",
      );
    }
  });

  it("should fail to transfer vest to another vester if account is fulled", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let currentStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    // current checkpoint account does not exist
    assert.equal(currentStakeAccountCheckpointsAddress, undefined);

    let previousStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newStakeAccountMetadataAddress,
        false,
      );

    let vestNowTransfered = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    try {
      await stakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: previousStakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVest: vestNowTransfered,
          newVestingBalance: newVestingBalance,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "TooManyCheckpoints",
      );
    }
  });

  it("should successfully create a new checkpoints account", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let currentStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    assert.equal(currentStakeAccountCheckpointsAddress, undefined);

    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeCheckpoints.getCheckpointCount(),
      TINY_CHECKPOINTS_ACCOUNT_LIMIT,
    );

    await stakeConnection.program.methods
      .createCheckpoints()
      .accounts({
        payer: accounts.vester,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    let previousStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    let newStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let previousVesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        previousStakeAccountCheckpointsAddress,
      );

    let newVesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        newStakeAccountCheckpointsAddress,
      );

    assert.equal(
      new PublicKey(newVesterStakeCheckpoints.checkpointData.owner).toBase58(),
      vesterStakeConnection.userPublicKey().toBase58(),
    );
    assert.equal(
      previousVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      newVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
    );
  });

  it("should successfully claim staked vest with created checkpoint account", async () => {
    let stakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataData =
      await stakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let delegateStakeAccountCheckpointsOwner =
      stakeAccountMetadataData.delegate;
    let delegateStakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        delegateStakeAccountCheckpointsOwner,
      );

    let delegateStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateStakeAccountMetadataAddress,
        false,
      );

    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vest: vestFewLater,
        stakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);
    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        delegateStakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "2674000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "2694000000",
    );
  });

  it("should successfully create a new checkpoints account after claim", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let currentStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    let currentStakeAccountCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        currentStakeAccountCheckpointsAddress,
      );
    // current checkpoint account not fully filled out
    assert.equal(
      currentStakeAccountCheckpoints.getCheckpointCount(),
      TINY_CHECKPOINTS_ACCOUNT_LIMIT - 2,
    );

    // filling the checkpoint account to the limit
    await sleep(4000)
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );
    await sleep(4000)
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    let vesterStakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );
    // a new checkpoint account must be created 
    assert.equal(
      vesterStakeAccountMetadata.stakeAccountCheckpointsLastIndex,
      2,
    );

    currentStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    // current checkpoint account does not exist
    assert.equal(currentStakeAccountCheckpointsAddress, undefined);

    let previousStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    let previousVesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        previousStakeAccountCheckpointsAddress,
      );

    // previous checkpoint account is filled
    assert.equal(
      previousVesterStakeCheckpoints.getCheckpointCount(),
      TINY_CHECKPOINTS_ACCOUNT_LIMIT,
    );

    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    await stakeConnection.program.methods
      .createCheckpoints()
      .accounts({
        payer: accounts.vester,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    previousStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        true,
      );

    let newStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    previousVesterStakeCheckpoints =
      await vesterStakeConnection.fetchCheckpointAccount(
        previousStakeAccountCheckpointsAddress,
      );

    let newVesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        newStakeAccountCheckpointsAddress,
      );

    assert.equal(
      new PublicKey(newVesterStakeCheckpoints.checkpointData.owner).toBase58(),
      vesterStakeConnection.userPublicKey().toBase58(),
    );
    assert.equal(
      previousVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      newVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
    );
  });

  it("should fail to transfer with incorrect stakeAccountMetadata", async () => {
    let incorrectStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        stakeConnection.userPublicKey(),
      );
    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        incorrectStakeAccountMetadataAddress,
        false,
      );

    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newStakeAccountMetadataAddress,
        false,
      );
    try {
      await stakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountMetadata: incorrectStakeAccountMetadataAddress,
          stakeAccountCheckpoints: incorrectStakeAccountCheckpointsAddress,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVestingBalance: newVestingBalance,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountOwner",
      );
    }
  });

  it("should fail to transfer with incorrect stakeAccountCheckpoints ", async () => {
    let incorrectStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        stakeConnection.userPublicKey(),
      );
    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        incorrectStakeAccountMetadataAddress,
        false,
      );

    let stakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newStakeAccountMetadataAddress,
        false,
      );
    try {
      await stakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: incorrectStakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVestingBalance: newVestingBalance,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountCheckpointsPDA",
      );
    }
  });

  it("should fail to transfer without stakeAccountMetadata", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newStakeAccountMetadataAddress,
        false,
      );
    try {
      await stakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          stakeAccountMetadata: null,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVestingBalance: newVestingBalance,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to transfer without stakeAccountCheckpoints", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newStakeAccountMetadataAddress,
        false,
      );
    try {
      await stakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVestingBalance: newVestingBalance,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to transfer vest to myself", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    try {
      await stakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          newStakeAccountMetadata: stakeAccountMetadataAddress,
          vesterTa: vesterTa,
          newVesterTa: vesterTa,
          newVest: vestNowForTransfer,
          newVestingBalance: vestingBalance,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([vester])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "TransferVestToMyself",
      );
    }
  });

  it("should successfully transfer vest to another vester", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newStakeAccountMetadataAddress,
        false,
      );

    let vestNowTransfered = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    await sleep(4000)
    await newVesterStakeConnection.delegateWithVest(
      newVesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    await stakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vest: vestNowForTransfer,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
        newStakeAccountMetadata: newStakeAccountMetadataAddress,
        newVest: vestNowTransfered,
        newVestingBalance: newVestingBalance,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    let updatedVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        vestingBalance,
      );

    let updatedNewVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );

    assert.equal(
      updatedVestingBalance.totalVestingBalance.toString(),
      "1337000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "2674000000",
    );
    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "1337000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "1377000000",
    );
  });

  it("should successfully claim a vest after transfer", async () => {
    let vestNowTransfered = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    let stakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let stakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
      );

    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vester: newVester.publicKey,
        vest: vestNowTransfered,
        vesterTa: newVesterTa,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        vestingBalance: newVestingBalance,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([newVester])
      .rpc({ skipPreflight: false })
      .then(confirm);

    let updatedVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );

    assert.equal(
      updatedVestingBalance.totalVestingBalance.toString(),
      "1337000000",
    );
  });

  it("should successfully create vesting balance and transfer vest to another vester without balance", async () => {
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let vesterStakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    await stakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vester: newVester.publicKey,
        vesterTa: newVesterTa,
        vestingBalance: newVestingBalance,
        vest: vestLaterForTransfer,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        newStakeAccountCheckpoints: null,
        newStakeAccountMetadata: null,
        newVestingBalance: vestingBalanceWithoutAccount,
        newVesterTa: vesterTaWithoutAccount,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([newVester])
      .rpc()
      .then(confirm);

    let updatedVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );

    let updatedNewVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        vestingBalanceWithoutAccount,
      );

    assert.equal(updatedVestingBalance.totalVestingBalance.toString(), "0");
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "1337000000",
    );
  });

  describe("InvalidVestingMint", () => {
    before(async () => {
      // Create fake token, fake configuration and fake vestingBalance account
      fakeMintAccount = Keypair.generate();
      fakeConfig = PublicKey.findProgramAddressSync(
        [
          Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
          whMintAuthority.publicKey.toBuffer(),
          fakeMintAccount.publicKey.toBuffer(),
          seed.toBuffer("le", 8),
        ],
        stakeConnection.program.programId,
      )[0];
      fakeAdminAta = getAssociatedTokenAddressSync(
        fakeMintAccount.publicKey,
        whMintAuthority.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      fakeVault = getAssociatedTokenAddressSync(
        fakeMintAccount.publicKey,
        fakeConfig,
        true,
        TOKEN_PROGRAM_ID,
      );
      fakeVesterTa = getAssociatedTokenAddressSync(
        fakeMintAccount.publicKey,
        vester.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      );
      fakeVestNow = PublicKey.findProgramAddressSync(
        [
          Buffer.from(wasm.Constants.VEST_SEED()),
          fakeConfig.toBuffer(),
          fakeVesterTa.toBuffer(),
          NOW.toBuffer("le", 8),
        ],
        stakeConnection.program.programId,
      )[0];

      const lamports = await getMinimumBalanceForRentExemptMint(
        stakeConnection.provider.connection,
      );
      let tx = new Transaction();
      tx.instructions = [
        SystemProgram.createAccount({
          fromPubkey: stakeConnection.provider.publicKey,
          newAccountPubkey: fakeMintAccount.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          fakeMintAccount.publicKey,
          6,
          whMintAuthority.publicKey,
          undefined,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          stakeConnection.provider.publicKey,
          fakeAdminAta,
          whMintAuthority.publicKey,
          fakeMintAccount.publicKey,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          whMintAuthority.publicKey,
          fakeVesterTa,
          vester.publicKey,
          fakeMintAccount.publicKey,
        ),
        createMintToInstruction(
          fakeMintAccount.publicKey,
          fakeAdminAta,
          whMintAuthority.publicKey,
          1e11,
        ),
      ];
      await stakeConnection.provider.sendAndConfirm(tx, [
        whMintAuthority,
        fakeMintAccount,
      ]);

      fakeAccounts = {
        ...accounts,
        mint: fakeMintAccount.publicKey,
        config: fakeConfig,
        vault: fakeVault,
        vesterTa: fakeVesterTa,
        adminAta: fakeAdminAta,
        recovery: fakeAdminAta,
      };

      await stakeConnection.program.methods
        .initializeVestingConfig(seed)
        .accounts({ ...fakeAccounts })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      fakeVestingBalanceAccount = PublicKey.findProgramAddressSync(
        [
          Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
          fakeConfig.toBuffer(),
          vester.publicKey.toBuffer(),
        ],
        stakeConnection.program.programId,
      )[0];

      fakeAccounts = {
        ...fakeAccounts,
        vestingBalance: fakeVestingBalanceAccount,
      };
      await stakeConnection.program.methods
        .createVestingBalance()
        .accounts({ ...fakeAccounts })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      fakeAccounts = { ...fakeAccounts, vest: fakeVestNow };
      await stakeConnection.program.methods
        .createVesting(NOW, new BN(1337e6))
        .accounts({ ...fakeAccounts })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      tx = new Transaction();
      tx.add(
        createTransferCheckedInstruction(
          fakeAdminAta,
          fakeMintAccount.publicKey,
          fakeVault,
          whMintAuthority.publicKey,
          1337e6,
          6,
          undefined,
          TOKEN_PROGRAM_ID,
        ),
      );
      await stakeConnection.provider.sendAndConfirm(tx, [whMintAuthority]);

      await stakeConnection.program.methods
        .finalizeVestingConfig()
        .accounts({ ...fakeAccounts })
        .signers([whMintAuthority])
        .rpc({ skipPreflight: true })
        .then(confirm);
    });

    it("should fail to delegate with invalid vesting token", async () => {
      await sleep(4000)
      let stakeAccountCheckpointsAddress =
        await vesterStakeConnection.delegateWithVest(
          vesterStakeConnection.userPublicKey(),
          WHTokenBalance.fromString("0"),
          true,
          config,
        );

      let delegateeStakeAccountMetadataAddress =
        await stakeConnection.getStakeMetadataAddress(
          vesterStakeConnection.userPublicKey(),
        );
      let delegateeStakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          delegateeStakeAccountMetadataAddress,
          false,
        );

      let currentDelegateStakeAccountOwner = await stakeConnection.delegates(
        stakeAccountCheckpointsAddress,
      );

      let currentDelegateStakeAccountMetadataAddress =
        await vesterStakeConnection.getStakeMetadataAddress(
          currentDelegateStakeAccountOwner,
        );

      let currentDelegateStakeAccountCheckpointsAddress =
        await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          currentDelegateStakeAccountMetadataAddress,
          false,
        );

      try {
        await vesterStakeConnection.program.methods
          .delegate(
            vesterStakeConnection.userPublicKey(),
            currentDelegateStakeAccountOwner,
          )
          .accounts({
            delegateeStakeAccountCheckpoints:
              delegateeStakeAccountCheckpointsAddress,
            currentDelegateStakeAccountCheckpoints:
              currentDelegateStakeAccountCheckpointsAddress,
            vestingConfig: fakeConfig,
            vestingBalance: fakeVestingBalanceAccount,
            mint: whMintAccount.publicKey,
          })
          .rpc()
          .then(confirm);

        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code === "InvalidVestingMint",
        );
      }
    });
  });
});
