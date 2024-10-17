import BN from "bn.js";
import { randomBytes } from "crypto";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import assert from "assert";
import {
  ANCHOR_CONFIG_PATH,
  getPortNumber,
  makeDefaultConfig,
  newUserStakeConnection,
  readAnchorConfig,
  standardSetup,
  startValidator,
  transferSolFromValidatorWallet,
} from "./utils/before";
import path from "path";
import { AnchorError, AnchorProvider, Program, utils } from "@coral-xyz/anchor";
import * as console from "node:console";
import { StakeConnection, WHTokenBalance } from "../app";
import { StakeAccountMetadata } from "../app/StakeConnection";
import { CheckpointAccount } from "../app/checkpoints";
import * as wasm from "@wormhole/staking-wasm";

const portNumber = getPortNumber(path.basename(__filename));

describe("vesting", () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
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
  const LATER = NOW.add(new BN(1000));
  const EVEN_LATER = LATER.add(new BN(1000));
  const EVEN_LATER_AGAIN = EVEN_LATER.add(new BN(1000));

  const vester = Keypair.generate();
  const seed = new BN(randomBytes(8));

  let accounts,
    config,
    vault,
    vesterTa,
    adminAta,
    vestNow,
    vestEvenLater,
    vestLater,
    vestEvenLaterAgain,
    vestingBalance,
    vesterStakeConnection;

  let fakeAccounts,
    fakeMintAccount,
    fakeConfig,
    fakeAdminAta,
    fakeVault,
    fakeVesterTa,
    fakeVestNow,
    fakeVestingBalanceAccount

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
      makeDefaultConfig(whMintAccount.publicKey, whMintAuthority.publicKey),
      WHTokenBalance.fromString("1000"),
    ));

    config = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.VESTING_CONFIG_SEED()),
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
    adminAta = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      whMintAuthority.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    vestNow = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        vesterTa.toBuffer(),
        NOW.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestLater = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        vesterTa.toBuffer(),
        LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestEvenLater = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        vesterTa.toBuffer(),
        EVEN_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestEvenLaterAgain = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        vesterTa.toBuffer(),
        EVEN_LATER_AGAIN.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    vestingBalance = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vester.publicKey.toBuffer(),
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

    await stakeConnection.createStakeAccount();
    await vesterStakeConnection.createStakeAccount();

    accounts = {
      admin: whMintAuthority.publicKey,
      payer: whMintAuthority.publicKey,
      mint: whMintAccount.publicKey,
      config,
      vault,
      vester: vester.publicKey,
      vesterTa,
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
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "ConstraintSeeds",
      );
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
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "ConstraintSeeds",
      );
    }

    fakeConfig = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.VESTING_CONFIG_SEED()),
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

  it("Create an unmatured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(LATER, new BN(1337e6))
      .accounts({ ...accounts, vest: vestLater })
      .signers([whMintAuthority])
      .rpc()
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
      .rpc()
      .then(confirm);
  });

  it("Fail to claim a vest before finalization", async () => {
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: null,
          globalConfig: null,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
      throw new Error("Shouldn't have made it to here!");
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
      .rpc()
      .then(confirm);
  });

  it("Finalizes the vest", async () => {
    await stakeConnection.program.methods
      .finalizeVestingConfig()
      .accounts({ ...accounts })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
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

  it("Fail to cancel a vest after finalization", async () => {
    try {
      await stakeConnection.program.methods
        .cancelVesting()
        .accounts({ ...accounts, vest: vestEvenLater })
        .signers([whMintAuthority])
        .rpc();
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "VestingFinalized");
    }
  });

  it("Fail to create a vest after finalize", async () => {
    try {
      await stakeConnection.program.methods
        .createVesting(EVEN_LATER_AGAIN, new BN(1337e6))
        .accounts({ ...accounts, vest: vestEvenLaterAgain })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "VestingFinalized");
    }
  });

  it("Fail to claim an unmatured vest", async () => {
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestEvenLater,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: null,
          globalConfig: null,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "NotFullyVested");
    }
  });

  it("Withdraw surplus tokens", async () => {
    await stakeConnection.program.methods
      .withdrawSurplus()
      .accounts({ ...accounts })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
  });

  it("should successfully delegate with vest", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegate_with_vest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config,
      );

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        stakeAccountCheckpointsAddress,
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "2674000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "2674000000",
    );
  });

  it("should fail to delegate with uninitialized vestingBalance account", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegate_with_vest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config,
      );

    let delegateeStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let currentDelegateStakeAccountCheckpointsAddress =
      await stakeConnection.delegates(stakeAccountCheckpointsAddress);

    let uninitializedVestingBalanceAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("uninitialized_vesting_balance"),
        config.toBuffer(),
        stakeConnection.userPublicKey().toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];

    try {
      await stakeConnection.program.methods
        .delegate(delegateeStakeAccountCheckpointsAddress)
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          vestingConfig: config,
          vestingBalance: uninitializedVestingBalanceAccount,
          mint: whMintAccount.publicKey,
        })
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "AccountNotInitialized",
      );
    }
  });

  it("should fail to delegate with vestingBalance account discriminator mismatch", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegate_with_vest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config,
      );

    let delegateeStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let currentDelegateStakeAccountCheckpointsAddress =
      await stakeConnection.delegates(stakeAccountCheckpointsAddress);

    try {
      await stakeConnection.program.methods
        .delegate(delegateeStakeAccountCheckpointsAddress)
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          vestingConfig: config,
          vestingBalance: config,
          mint: whMintAccount.publicKey,
        })
        .rpc()
        .then(confirm);
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
          globalConfig: null,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to claim without stakeAccountCheckpoints", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
      );
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: null,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: null,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to claim without globalConfig", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
      );
    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestNow,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: null,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ErrorOfStakeAccountParsing",
      );
    }
  });

  it("should fail to claim with incorrect stakeAccountMetadata owner", async () => {
    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddress(
        stakeConnection.userPublicKey(),
      );
    let incorrectStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        incorrectStakeAccountCheckpointsAddress,
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
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountOwner",
      );
    }
  });

  it("should fail to claim with incorrect stakeAccountCheckpoints ", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
      );

    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddress(
        stakeConnection.userPublicKey(),
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
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountCheckpoints",
      );
    }
  });

  it("should successfully claim staked vest", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
      );

    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vest: vestNow,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        stakeAccountCheckpointsAddress,
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "1337000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "1337000000",
    );
  });

  describe("InvalidVestingMint", () => {
    before(async () => {
      // Create fake token, fake configuration and fake vestingBalance account
      fakeMintAccount = Keypair.generate();
      fakeConfig = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.VESTING_CONFIG_SEED()),
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
          Buffer.from("vest"),
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
          utils.bytes.utf8.encode(wasm.Constants.VESTING_BALANCE_SEED()),
          fakeConfig.toBuffer(),
          vester.publicKey.toBuffer(),
        ],
        stakeConnection.program.programId,
      )[0];

      fakeAccounts = { ...fakeAccounts, vestingBalance: fakeVestingBalanceAccount };
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

      await stakeConnection.program.methods
        .finalizeVestingConfig()
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
          1339e7,
          6,
          undefined,
          TOKEN_PROGRAM_ID,
        ),
      );
      await stakeConnection.provider.sendAndConfirm(tx, [whMintAuthority]);
    });

    it("should fail to delegate with invalid vesting token", async () => {
      let stakeAccountCheckpointsAddress =
        await vesterStakeConnection.delegate_with_vest(
          vesterStakeConnection.userPublicKey(),
          WHTokenBalance.fromString("0"),
          true,
          config,
        );
      let delegateeStakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddress(
          vesterStakeConnection.userPublicKey(),
        );
      let currentDelegateStakeAccountCheckpointsAddress =
        await stakeConnection.delegates(stakeAccountCheckpointsAddress);

      try {
        await vesterStakeConnection.program.methods
          .delegate(delegateeStakeAccountCheckpointsAddress)
          .accounts({
            currentDelegateStakeAccountCheckpoints:
              currentDelegateStakeAccountCheckpointsAddress,
            delegateeStakeAccountCheckpoints:
              delegateeStakeAccountCheckpointsAddress,
            stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
            vestingConfig: fakeConfig,
            vestingBalance: fakeVestingBalanceAccount,
            mint: whMintAccount.publicKey,
          })
          .rpc()
          .then(confirm);
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code === "InvalidVestingMint",
        );
      }
    });

    it("should fail to claim with invalid vesting token", async () => {
      let stakeAccountCheckpointsAddress =
        await vesterStakeConnection.getStakeAccountCheckpointsAddress(
          vesterStakeConnection.userPublicKey(),
        );
      let stakeAccountMetadataAddress =
        await vesterStakeConnection.getStakeMetadataAddress(
          stakeAccountCheckpointsAddress,
        );

      try {
        await vesterStakeConnection.program.methods
          .claimVesting()
          .accounts({
            ...fakeAccounts,
            vest: fakeVestNow,
            stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
            stakeAccountMetadata: stakeAccountMetadataAddress,
            globalConfig: stakeConnection.configAddress,
          })
          .rpc()
          .then(confirm);
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code === "InvalidVestingMint",
        );
      }
    });
  });
});
