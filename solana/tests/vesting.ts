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
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import assert from "assert";
import {
  ANCHOR_CONFIG_PATH,
  getPortNumber,
  makeDefaultConfig,
  newUserStakeConnection,
  readAnchorConfig,
  standardSetup,
} from "./utils/before";
import path from "path";
import { AnchorError } from "@coral-xyz/anchor";
import { StakeConnection, WHTokenBalance } from "../app";
import { StakeAccountMetadata } from "../app/StakeConnection";
import { CheckpointAccount } from "../app/checkpoints";

const portNumber = getPortNumber(path.basename(__filename));

describe("vesting", () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();

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
  const LATER = NOW.add(new BN(1000));
  const EVEN_LATER = LATER.add(new BN(1000));
  const EVEN_LATER_AGAIN = EVEN_LATER.add(new BN(1000));

  const admin = Keypair.generate();
  const vester = Keypair.generate();
  const newVester = Keypair.generate();
  const vesterWithoutAccount = Keypair.generate();
  const mint = Keypair.generate();
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
    newVestingBalance,
    vestingBalanceWithoutAccount,
    vesterStakeConnection,
    newVesterStakeConnection;

  before(async () => {
    const anchorConfig = readAnchorConfig(ANCHOR_CONFIG_PATH);
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      makeDefaultConfig(whMintAccount.publicKey),
      WHTokenBalance.fromString("1000"),
    ));

    config = PublicKey.findProgramAddressSync(
      [
        Buffer.from("config"),
        admin.publicKey.toBuffer(),
        mint.publicKey.toBuffer(),
        seed.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vault = getAssociatedTokenAddressSync(
      mint.publicKey,
      config,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    vesterTa = getAssociatedTokenAddressSync(
      mint.publicKey,
      vester.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    vesterTa = getAssociatedTokenAddressSync(
      mint.publicKey,
      vester.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    newVesterTa = getAssociatedTokenAddressSync(
      mint.publicKey,
      newVester.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    newVesterTa = getAssociatedTokenAddressSync(
      mint.publicKey,
      newVester.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    vesterTaWithoutAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      vesterWithoutAccount.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    adminAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      admin.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
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

    vestLaterForTransfer = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vest"),
        config.toBuffer(),
        newVesterTa.toBuffer(),
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
      [Buffer.from("vesting_balance"), vester.publicKey.toBuffer()],
      stakeConnection.program.programId,
    )[0];

    newVestingBalance = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_balance"), newVester.publicKey.toBuffer()],
      stakeConnection.program.programId,
    )[0];

    vestingBalanceWithoutAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting_balance"),
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
      admin: admin.publicKey,
      payer: admin.publicKey,
      mint: mint.publicKey,
      config,
      vault,
      vester: vester.publicKey,
      vesterTa,
      newVesterTa,
      adminAta,
      recovery: adminAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      vestingBalance: vestingBalance,
    };
  });

  it("Airdrop", async () => {
    let lamports = await getMinimumBalanceForRentExemptMint(
      stakeConnection.provider.connection,
    );
    let tx = new Transaction();
    tx.instructions = [
      ...[admin, vester].map((k) =>
        SystemProgram.transfer({
          fromPubkey: stakeConnection.provider.publicKey,
          toPubkey: k.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        }),
      ),
      SystemProgram.createAccount({
        fromPubkey: stakeConnection.provider.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        6,
        admin.publicKey,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        stakeConnection.provider.publicKey,
        adminAta,
        admin.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        stakeConnection.provider.publicKey,
        newVesterTa,
        newVester.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        stakeConnection.provider.publicKey,
        vesterTa,
        vester.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        stakeConnection.provider.publicKey,
        vesterTaWithoutAccount,
        vesterWithoutAccount.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),

      createMintToInstruction(
        mint.publicKey,
        adminAta,
        admin.publicKey,
        1e11,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      ),
    ];
    await stakeConnection.provider.sendAndConfirm(tx, [admin, mint]);
  });

  it("Initialize config", async () => {
    await stakeConnection.program.methods
      .initializeVestingConfig(seed)
      .accounts({ ...accounts })
      .signers([admin])
      .rpc()
      .then(confirm);
  });

  it("Create vesting balance", async () => {
    await stakeConnection.program.methods
      .createVestingBalance()
      .accounts({ ...accounts, vestingBalance: vestingBalance })
      .signers([admin])
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
      .signers([admin])
      .rpc()
      .then(confirm);
  });

  it("Create a matured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(NOW, new BN(1337e6))
      .accounts({ ...accounts, vest: vestNow })
      .signers([admin])
      .rpc({
        skipPreflight: true,
      })
      .then(confirm);
  });

  it("Create another matured vests", async () => {
    await stakeConnection.program.methods
      .createVesting(FEW_LATER, new BN(1337e6))
      .accounts({ ...accounts, vest: vestNowForTransfer })
      .signers([admin])
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
      .signers([admin])
      .rpc()
      .then(confirm);
  });

  it("Create an unmatured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(LATER, new BN(1337e6))
      .accounts({ ...accounts, vest: vestLater })
      .signers([admin])
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
      .signers([admin])
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
      .signers([admin])
      .rpc()
      .then(confirm);
  });

  it("Finalizes the vest", async () => {
    await stakeConnection.program.methods
      .finalizeVestingConfig()
      .accounts({ ...accounts })
      .signers([admin])
      .rpc()
      .then(confirm);
  });

  it("Deposits vesting tokens", async () => {
    const tx = new Transaction();
    tx.add(
      createTransferCheckedInstruction(
        adminAta,
        mint.publicKey,
        vault,
        admin.publicKey,
        1339e7,
        6,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    await stakeConnection.provider.sendAndConfirm(tx, [admin]);
  });

  it("Fail to cancel a vest after finalization", async () => {
    try {
      await stakeConnection.program.methods
        .cancelVesting()
        .accounts({ ...accounts, vest: vestEvenLater })
        .signers([admin])
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
        .signers([admin])
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
      .signers([admin])
      .rpc()
      .then(confirm);
  });

  it("should successfully stake vest", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegate_with_vest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
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
      "4011000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "4011000000",
    );
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
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingBalance",
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
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingBalance",
      );
    }
  });

  it("should fail to claim with incorrect stakeAccountMetadata", async () => {
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
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingBalance",
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
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingBalance",
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
      "2674000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "2674000000",
    );
  });

  it("should fail to transfer with incorrect stakeAccountMetadata", async () => {
    let incorrectStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddress(
        stakeConnection.userPublicKey(),
      );
    let incorrectStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        incorrectStakeAccountCheckpointsAddress,
      );

    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newStakeAccountCheckpointsAddress,
      );
    try {
      await stakeConnection.program.methods
        .transferVesting(newVester.publicKey)
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: incorrectStakeAccountCheckpointsAddress,
          stakeAccountMetadata: incorrectStakeAccountMetadataAddress,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVestingBalance: newVestingBalance,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingBalance",
      );
    }
  });

  it("should fail to transfer with incorrect stakeAccountCheckpoints ", async () => {
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
    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newStakeAccountCheckpointsAddress,
      );
    try {
      await stakeConnection.program.methods
        .transferVesting(newVester.publicKey)
        .accounts({
          ...accounts,
          vest: vestNowForTransfer,
          stakeAccountCheckpoints: incorrectStakeAccountCheckpointsAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newStakeAccountMetadata: newStakeAccountMetadataAddress,
          newVestingBalance: newVestingBalance,
        })
        .signers([vester])
        .rpc()
        .then(confirm);
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountCheckpointsPDA",
      );
    }
  });

  it("should successfully transfer vest to another vester", async () => {
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let stakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
      );

    let newStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newStakeAccountCheckpointsAddress,
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

    await stakeConnection.program.methods
      .transferVesting(newVester.publicKey)
      .accounts({
        ...accounts,
        vest: vestNowForTransfer,
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        newStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
        newStakeAccountMetadata: newStakeAccountMetadataAddress,
        newVest: vestNowTransfered,
        newVestingBalance: newVestingBalance,
      })
      .signers([vester])
      .rpc({
        skipPreflight: false,
      })
      .then(confirm);

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        stakeAccountCheckpointsAddress,
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
      "1337000000",
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

    let stakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let stakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
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
    let stakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddress(
        vesterStakeConnection.userPublicKey(),
      );

    let stakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        stakeAccountCheckpointsAddress,
      );

    await stakeConnection.program.methods
      .transferVesting(vesterTaWithoutAccount.publicKey)
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
      })
      .signers([newVester])
      .rpc({
        skipPreflight: false,
      })
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
});
