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

describe("vesting", () => {
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
  const FEW_LATER_3 = NOW.add(new BN(3));
  const LATER = NOW.add(new BN(1000));
  const EVEN_LATER = LATER.add(new BN(1000));
  const EVEN_LATER_AGAIN = EVEN_LATER.add(new BN(1000));

  const TINY_CHECKPOINTS_ACCOUNT_LIMIT = 4;

  const vester = Keypair.generate();
  const vester2 = Keypair.generate();
  const vester3 = Keypair.generate();
  const newVester = Keypair.generate();
  const newVester2 = Keypair.generate();
  const newVester3 = Keypair.generate();
  const vesterWithoutAccount = Keypair.generate();
  const seed = new BN(randomBytes(8));
  const seed2 = new BN(randomBytes(8));

  let accounts,
    config,
    config2,
    vault,
    vault2,
    vesterTa,
    vester2Ta,
    vester3Ta,
    newVesterTa,
    newVester2Ta,
    newVester3Ta,
    vesterTaWithoutAccount,
    adminAta,
    vestNow,
    vestNow2,
    vestEvenLater,
    vestLater,
    vestLaterForTransfer,
    vestEvenLaterAgain,
    vestNowForTransfer,
    vest2NowForTransfer,
    vest3NowForTransfer,
    vestNowForTransfer3,
    vestNowTransfered3,
    vestingBalance,
    vesting2Balance,
    vesting3Balance,
    vestingBalance2,
    vestFewLater,
    vesterStakeConnection,
    vester2StakeConnection,
    vester3StakeConnection,
    newVestingBalance,
    newVesting2Balance,
    newVesting3Balance,
    vestingBalanceWithoutAccount,
    newVesterStakeConnection,
    newVester2StakeConnection,
    newVester3StakeConnection;

  let fakeAccounts,
    fakeMintAccount,
    fakeConfig,
    fakeAdminAta,
    fakeVault,
    fakeVesterTa;

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
        whMintAccount.publicKey.toBuffer(),
        seed.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    config2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
        whMintAccount.publicKey.toBuffer(),
        seed2.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vault = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      config,
      true,
      TOKEN_PROGRAM_ID,
    );
    vault2 = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      config2,
      true,
      TOKEN_PROGRAM_ID,
    );
    vesterTa = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      vester.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    vester2Ta = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      vester2.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    vester3Ta = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      vester3.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    newVesterTa = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      newVester.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    newVester2Ta = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      newVester2.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    newVester3Ta = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      newVester3.publicKey,
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
    vestNow2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config2.toBuffer(),
        vesterTa.toBuffer(),
        NOW.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vestFewLater = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
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
        Buffer.from(wasm.Constants.VEST_SEED()),
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
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vest2NowForTransfer = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vester2Ta.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vest3NowForTransfer = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vester3Ta.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vestNowForTransfer3 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        vesterTa.toBuffer(),
        FEW_LATER_3.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];
    vestNowTransfered3 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        FEW_LATER_3.toBuffer("le", 8),
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
    vesting2Balance = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vester2.publicKey.toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];
    vesting3Balance = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vester3.publicKey.toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];
    vestingBalance2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config2.toBuffer(),
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
    newVesting2Balance = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        newVester2.publicKey.toBuffer(),
      ],
      stakeConnection.program.programId,
    )[0];
    newVesting3Balance = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        newVester3.publicKey.toBuffer(),
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

    vester2StakeConnection = await newUserStakeConnection(
      stakeConnection,
      vester2,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );

    vester3StakeConnection = await newUserStakeConnection(
      stakeConnection,
      vester3,
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

    newVester2StakeConnection = await newUserStakeConnection(
      stakeConnection,
      newVester2,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );

    newVester3StakeConnection = await newUserStakeConnection(
      stakeConnection,
      newVester3,
      anchorConfig,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );

    await stakeConnection.createStakeAccount();
    await vesterStakeConnection.createStakeAccount();
    await vester2StakeConnection.createStakeAccount();
    await vester3StakeConnection.createStakeAccount();
    await newVesterStakeConnection.createStakeAccount();
    await newVester2StakeConnection.createStakeAccount();
    await newVester3StakeConnection.createStakeAccount();

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
      ...[whMintAuthority, vester, vester2, vester3, fakeVestingAdmin].map((k) =>
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
        vester2Ta,
        vester2.publicKey,
        whMintAccount.publicKey,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        whMintAuthority.publicKey,
        vester3Ta,
        vester3.publicKey,
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
        newVester2Ta,
        newVester2.publicKey,
        whMintAccount.publicKey,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        whMintAuthority.publicKey,
        newVester3Ta,
        newVester3.publicKey,
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

  it("should fail to initialize vesting config with invalid mint", async () => {
    fakeMintAccount = Keypair.generate();
    fakeConfig = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
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

    try {
      await stakeConnection.program.methods
        .initializeVestingConfig(seed)
        .accounts({ ...fakeAccounts })
        .signers([whMintAuthority])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintAddress");
    }
  });

  it("should fail to initialize vesting config with invalid admin", async () => {
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

    await stakeConnection.program.methods
      .initializeVestingConfig(seed2)
      .accounts({
        ...accounts,
        config: config2,
        vault: vault2,
      })
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
          assert((e as AnchorError).error?.errorCode?.code === "InvalidVestingAdmin");
      }
      fakeConfig = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
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
        (e as AnchorError).error?.errorCode?.code === "InvalidVestingAdmin",
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
        vestingBalance: vesting2Balance,
        vesterTa: vester2Ta,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVestingBalance()
      .accounts({
        ...accounts,
        vestingBalance: vesting3Balance,
        vesterTa: vester3Ta,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

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

    await stakeConnection.program.methods
      .createVestingBalance()
      .accounts({
        ...accounts,
        vestingBalance: newVesting2Balance,
        vesterTa: newVester2Ta,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVestingBalance()
      .accounts({
        ...accounts,
        config: config2,
        vestingBalance: vestingBalance2,
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
      assert((e as AnchorError).error?.errorCode?.code === "InvalidVestingAdmin");
    }
  });

  it("Create a matured vest", async () => {
    await stakeConnection.program.methods
      .createVesting(NOW, new BN(1237e6))
      .accounts({ ...accounts, vest: vestNow })
      .signers([whMintAuthority])
      .rpc({
        skipPreflight: true,
      })
      .then(confirm);
  });

  it("Create another matured vests", async () => {
    await stakeConnection.program.methods
      .createVesting(NOW, new BN(100e6))
      .accounts({
        ...accounts,
        config: config2,
        vestingBalance: vestingBalance2,
        vest: vestNow2,
      })
      .signers([whMintAuthority])
      .rpc({
        skipPreflight: true,
      })
      .then(confirm);

    await stakeConnection.program.methods
      .createVesting(FEW_LATER, new BN(1016e6))
      .accounts({ ...accounts, vest: vestNowForTransfer })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVesting(FEW_LATER, new BN(1016e6))
      .accounts({
        ...accounts,
        vest: vest2NowForTransfer,
        vesterTa: vester2Ta,
        vestingBalance: vesting2Balance,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVesting(FEW_LATER, new BN(1016e6))
      .accounts({
        ...accounts,
        vest: vest3NowForTransfer,
        vesterTa: vester3Ta,
        vestingBalance: vesting3Balance,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVesting(FEW_LATER_3, new BN(321e6))
      .accounts({ ...accounts, vest: vestNowForTransfer3 })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVesting(FEW_LATER_3, new BN(321e6))
      .accounts({
        ...accounts,
        vest: vestNowTransfered3,
        vesterTa: newVesterTa,
        vestingBalance: newVestingBalance,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);

    await stakeConnection.program.methods
      .createVesting(LATER, new BN(1016e6))
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
      .rpc()
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
          delegateStakeAccountCheckpoints: null,
          delegateStakeAccountMetadata: null,
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
        14606e6,
        6,
        undefined,
        TOKEN_PROGRAM_ID,
      ),
    );
    tx.add(
      createTransferCheckedInstruction(
        adminAta,
        whMintAccount.publicKey,
        vault2,
        whMintAuthority.publicKey,
        100e6,
        6,
        undefined,
        TOKEN_PROGRAM_ID,
      ),
    );
    await stakeConnection.provider.sendAndConfirm(tx, [whMintAuthority]);
  });

  it("should successfully finalize vesting when vault token balance is greater than vestingConfig.vested", async () => {
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

    await stakeConnection.program.methods
      .finalizeVestingConfig()
      .accounts({ ...accounts })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);
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
      assert((e as AnchorError).error?.errorCode?.code === "InvalidVestingAdmin");
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

  it("Finalizes the vesting config2", async () => {
    await stakeConnection.program.methods
      .finalizeVestingConfig()
      .accounts({
        ...accounts,
        config: config2,
        vault: vault2,
      })
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
          delegateStakeAccountCheckpoints: null,
          delegateStakeAccountMetadata: null,
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
    await sleep(2000);
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
      "5248000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "5248000000",
    );
  });

  it("should successfully delegate with vest from different configs", async () => {
    await sleep(2000);
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("0"),
      true,
      config,
    );

    await sleep(2000);
    let stakeAccountCheckpointsAddress =
      await vesterStakeConnection.delegateWithVest(
        vesterStakeConnection.userPublicKey(),
        WHTokenBalance.fromString("0"),
        true,
        config2,
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
    await sleep(2000);
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
      vesterStakeConnection.userPublicKey(),
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

  it("should fail to delegate if vesting balance PDA does not match vesting config PDA", async () => {
    await sleep(2000);
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("0"),
      true,
      config,
    );

    let delegateeStakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        vesterStakeConnection.userPublicKey(),
      );
    let delegateeStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateeStakeAccountMetadataAddress,
        false,
      );

    let currentDelegateStakeAccountOwner =
      await vesterStakeConnection.delegates(
        vesterStakeConnection.userPublicKey(),
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

    let vestingBalanceAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        vesterStakeConnection.userPublicKey().toBuffer(),
      ],
      vesterStakeConnection.program.programId,
    )[0];

    let delegateeStakeAccountCheckpointsData =
      await vesterStakeConnection.program.account.checkpointData.fetch(
        delegateeStakeAccountCheckpointsAddress,
      );

    let delegateeStakeAccountOwner = delegateeStakeAccountCheckpointsData.owner;

    const seed2 = new BN(randomBytes(8));
    const vestingConfig2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
        whMintAccount.publicKey.toBuffer(),
        seed2.toBuffer("le", 8),
      ],
      vesterStakeConnection.program.programId,
    )[0];
    const vault2 = getAssociatedTokenAddressSync(
      whMintAccount.publicKey,
      vestingConfig2,
      true,
      TOKEN_PROGRAM_ID,
    );
    await vesterStakeConnection.program.methods
      .initializeVestingConfig(seed2)
      .accounts({
        ...accounts,
        config: vestingConfig2,
        vault: vault2,
      })
      .signers([whMintAuthority])
      .rpc()
      .then(confirm);
    await vesterStakeConnection.program.methods
      .finalizeVestingConfig()
      .accounts({
        ...accounts,
        config: vestingConfig2,
        vault: vault2,
      })
      .signers([whMintAuthority])
      .rpc({ skipPreflight: true })
      .then(confirm);

    try {
      await vesterStakeConnection.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegateStakeAccountOwner)
        .accounts({
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          vestingConfig: vestingConfig2,
          vestingBalance: vestingBalanceAccount,
          mint: whMintAccount.publicKey,
        })
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidVestingBalancePDA",
      );
    }
  });

  it("should fail to delegate with vestingBalance account discriminator mismatch", async () => {
    await sleep(2000);
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
      vesterStakeConnection.userPublicKey(),
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
          delegateStakeAccountCheckpoints: null,
          delegateStakeAccountMetadata: null,
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
          delegateStakeAccountCheckpoints: null,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
          delegateStakeAccountCheckpoints:
            incorrectStakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: incorrectStakeAccountMetadataAddress,
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
          delegateStakeAccountCheckpoints:
            incorrectStakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
      notFulledStakeCheckpoints.getCheckpointCount() <
        TINY_CHECKPOINTS_ACCOUNT_LIMIT,
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

    await sleep(2000);
    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vest: vestNow,
        delegateStakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
      "4111000000",
    );
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "4111000000",
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
      TINY_CHECKPOINTS_ACCOUNT_LIMIT - 1,
    );

    assert.equal(
      vesterStakeAccountMetadata.recordedVestingBalance.toString(),
      "4111000000",
    );
    assert.equal(
      currentStakeAccountCheckpoints.getLastCheckpoint().value.toString(),
      "4111000000",
    );

    // filling the checkpoint account to the limit
    await sleep(2000);
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("20"),
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

    let delegateStakeAccountCheckpointsOwner =
      vesterStakeAccountMetadata.delegate;
    let delegateStakeAccountMetadataAddress =
      await vesterStakeConnection.getStakeMetadataAddress(
        delegateStakeAccountCheckpointsOwner,
      );

    let delegateStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateStakeAccountMetadataAddress,
        true,
      );

    assert.equal(
      vesterStakeAccountMetadata.recordedVestingBalance.toString(),
      "4111000000",
    );
    assert.equal(
      vesterStakeAccountMetadata.recordedBalance.toString(),
      "20000000",
    );
    assert.equal(
      previousVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "4131000000",
    );

    try {
      await stakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vest: vestFewLater,
          delegateStakeAccountCheckpoints:
            delegateStakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
    let delegateeStakeAccountOwner = vesterStakeConnection.userPublicKey();
    let delegateeStakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(delegateeStakeAccountOwner);
    let delegateeStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateeStakeAccountMetadataAddress,
        true,
      );

    let currentDelegate = await vesterStakeConnection.delegates(
      vesterStakeConnection.userPublicKey(),
    );
    assert.equal(
      currentDelegate.toBase58(),
      vesterStakeConnection.userPublicKey().toBase58(),
    );
    let currentDelegateStakeAccountAddress =
      await vesterStakeConnection.getStakeMetadataAddress(currentDelegate);
    let currentDelegateStakeAccountCheckpointsAddress =
      await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        currentDelegateStakeAccountAddress,
        true,
      );

    let vestingBalanceAccount = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.VESTING_BALANCE_SEED()),
        config.toBuffer(),
        delegateeStakeAccountOwner.toBuffer(),
      ],
      vesterStakeConnection.program.programId,
    )[0];

    try {
      await stakeConnection.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegate)
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
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
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
        Buffer.from(wasm.Constants.VEST_SEED()),
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
          delegateStakeAccountCheckpoints:
            previousStakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
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
        (e as AnchorError).error?.errorCode?.code === "TooManyCheckpoints",
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

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "4111000000",
    );
    assert.equal(vesterStakeMetadata.recordedBalance.toString(), "20000000");
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "4131000000",
    );

    await sleep(2000);
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

    vesterStakeMetadata = await vesterStakeConnection.fetchStakeAccountMetadata(
      vesterStakeConnection.userPublicKey(),
    );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "4111000000",
    );
    assert.equal(vesterStakeMetadata.recordedBalance.toString(), "20000000");
    assert.equal(
      newVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "4131000000",
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

    await sleep(2000);
    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vest: vestFewLater,
        delegateStakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
      "2774000000",
    );
    assert.equal(vesterStakeMetadata.recordedBalance.toString(), "20000000");
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "2794000000",
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
    await sleep(2000);
    await vesterStakeConnection.delegateWithVest(
      vesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );
    await sleep(2000);
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

    assert.equal(
      vesterStakeAccountMetadata.recordedVestingBalance.toString(),
      "2774000000",
    );
    assert.equal(
      vesterStakeAccountMetadata.recordedBalance.toString(),
      "40000000",
    );
    assert.equal(
      previousVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "2814000000",
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

    vesterStakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

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

    assert.equal(
      vesterStakeAccountMetadata.recordedVestingBalance.toString(),
      "2774000000",
    );
    assert.equal(
      vesterStakeAccountMetadata.recordedBalance.toString(),
      "40000000",
    );
    assert.equal(
      newVesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "2814000000",
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
          delegateStakeAccountMetadata: incorrectStakeAccountMetadataAddress,
          stakeAccountMetadata: incorrectStakeAccountMetadataAddress,
          delegateStakeAccountCheckpoints:
            incorrectStakeAccountCheckpointsAddress,
          newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
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

  it("should fail to transfer with incorrect stakeAccountCheckpoints", async () => {
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
          delegateStakeAccountCheckpoints:
            incorrectStakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
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
          "InvalidStakeAccountCheckpoints",
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
          delegateStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: null,
          stakeAccountMetadata: null,
          newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
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
          delegateStakeAccountCheckpoints: null,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
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
          delegateStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
        (e as AnchorError).error?.errorCode?.code === "TransferVestToMyself",
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
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    await sleep(2000);
    await newVesterStakeConnection.delegateWithVest(
      newVesterStakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
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
      "2674000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "1337000000",
    );

    await stakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vest: vestNowForTransfer,
        delegateStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: stakeAccountMetadataAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
        newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
        newStakeAccountMetadata: newStakeAccountMetadataAddress,
        newVest: vestNowTransfered,
        newVestingBalance: newVestingBalance,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    updatedVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        vestingBalance,
      );

    updatedNewVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );

    assert.equal(
      updatedVestingBalance.totalVestingBalance.toString(),
      "1658000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "2353000000",
    );

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "1758000000",
    );
    assert.equal(vesterStakeMetadata.recordedBalance.toString(), "40000000");
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "1798000000",
    );
  });

  it("should fail to transfer vest to another vester with votes delegated to another user with incorrect accounts", async () => {
    let newVester3StakeAccountMetadataAddress =
      await newVester3StakeConnection.getStakeMetadataAddress(
        newVester3StakeConnection.userPublicKey(),
      );
    let newVester3StakeAccountCheckpointsAddress =
      await newVester3StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newVester3StakeAccountMetadataAddress,
        false,
      );

    let vester2StakeAccountMetadataAddress =
      await vester2StakeConnection.getStakeMetadataAddress(
        vester2StakeConnection.userPublicKey(),
      );
    let vester2StakeAccountCheckpointsAddress =
      await vester2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        vester2StakeAccountMetadataAddress,
        false,
      );

    await sleep(2000);
    await vester2StakeConnection.delegateWithVest(
      newVester3StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    let newVester2StakeAccountMetadataAddress =
      await newVester2StakeConnection.getStakeMetadataAddress(
        newVester2StakeConnection.userPublicKey(),
      );
    let newVester2StakeAccountCheckpointsAddress =
      await newVester2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newVester2StakeAccountMetadataAddress,
        false,
      );

    let vestNowTransfered = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVester2Ta.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    await sleep(2000);
    await newVester2StakeConnection.delegateWithVest(
      newVester2StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    try {
      await vester2StakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vester: vester2.publicKey,
          vesterTa: vester2Ta,
          newVesterTa: newVester2Ta,
          vest: vest2NowForTransfer,
          vestingBalance: vesting2Balance,
          delegateStakeAccountCheckpoints:
            vester2StakeAccountCheckpointsAddress, // invalid delegateStakeAccountCheckpoints
          delegateStakeAccountMetadata: newVester3StakeAccountMetadataAddress,
          stakeAccountMetadata: vester2StakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints:
            newVester2StakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata:
            newVester2StakeAccountMetadataAddress,
          newStakeAccountMetadata: newVester2StakeAccountMetadataAddress,
          newVest: vestNowTransfered,
          newVestingBalance: newVesting2Balance,
          globalConfig: vester2StakeConnection.configAddress,
        })
        .signers([vester2])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountCheckpoints",
      );
    }

    try {
      await vester2StakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vester: vester2.publicKey,
          vesterTa: vester2Ta,
          newVesterTa: newVester2Ta,
          vest: vest2NowForTransfer,
          vestingBalance: vesting2Balance,
          delegateStakeAccountCheckpoints:
            newVester3StakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: vester2StakeAccountMetadataAddress, // invalid delegateStakeAccountMetadata
          stakeAccountMetadata: vester2StakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints:
            newVester2StakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata:
            newVester2StakeAccountMetadataAddress,
          newStakeAccountMetadata: newVester2StakeAccountMetadataAddress,
          newVest: vestNowTransfered,
          newVestingBalance: newVesting2Balance,
          globalConfig: vester2StakeConnection.configAddress,
        })
        .signers([vester2])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountOwner",
      );
    }

    try {
      await vester2StakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vester: vester2.publicKey,
          vesterTa: vester2Ta,
          newVesterTa: newVester2Ta,
          vest: vest2NowForTransfer,
          vestingBalance: vesting2Balance,
          delegateStakeAccountCheckpoints:
            newVester3StakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: newVester3StakeAccountMetadataAddress,
          stakeAccountMetadata: vester2StakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints:
            newVester3StakeAccountCheckpointsAddress, // invalid newDelegateStakeAccountCheckpoints
          newDelegateStakeAccountMetadata:
            newVester2StakeAccountMetadataAddress,
          newStakeAccountMetadata: newVester2StakeAccountMetadataAddress,
          newVest: vestNowTransfered,
          newVestingBalance: newVesting2Balance,
          globalConfig: vester2StakeConnection.configAddress,
        })
        .signers([vester2])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountCheckpoints",
      );
    }

    try {
      await vester2StakeConnection.program.methods
        .transferVesting()
        .accounts({
          ...accounts,
          vester: vester2.publicKey,
          vesterTa: vester2Ta,
          newVesterTa: newVester2Ta,
          vest: vest2NowForTransfer,
          vestingBalance: vesting2Balance,
          delegateStakeAccountCheckpoints:
            newVester3StakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: newVester3StakeAccountMetadataAddress,
          stakeAccountMetadata: vester2StakeAccountMetadataAddress,
          newDelegateStakeAccountCheckpoints:
            newVester2StakeAccountCheckpointsAddress,
          newDelegateStakeAccountMetadata:
            newVester3StakeAccountMetadataAddress, // invalid newDelegateStakeAccountMetadata
          newStakeAccountMetadata: newVester2StakeAccountMetadataAddress,
          newVest: vestNowTransfered,
          newVestingBalance: newVesting2Balance,
          globalConfig: vester2StakeConnection.configAddress,
        })
        .signers([vester2])
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

  it("should successfully transfer vest to another vester with votes delegated to another user", async () => {
    let newVester3StakeAccountMetadataAddress =
      await newVester3StakeConnection.getStakeMetadataAddress(
        newVester3StakeConnection.userPublicKey(),
      );
    let newVester3StakeAccountCheckpointsAddress =
      await newVester3StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newVester3StakeAccountMetadataAddress,
        false,
      );

    let vester2StakeAccountMetadataAddress =
      await vester2StakeConnection.getStakeMetadataAddress(
        vester2StakeConnection.userPublicKey(),
      );
    let vester2StakeAccountCheckpointsAddress =
      await vester2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        vester2StakeAccountMetadataAddress,
        false,
      );

    await sleep(2000);
    await vester2StakeConnection.delegateWithVest(
      vester2StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    await sleep(2000);
    await vester2StakeConnection.delegateWithVest(
      newVester3StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    let newVester2StakeAccountMetadataAddress =
      await newVester2StakeConnection.getStakeMetadataAddress(
        newVester2StakeConnection.userPublicKey(),
      );
    let newVester2StakeAccountCheckpointsAddress =
      await newVester2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newVester2StakeAccountMetadataAddress,
        false,
      );

    let vestNowTransfered = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVester2Ta.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    await sleep(2000);
    await newVester2StakeConnection.delegateWithVest(
      newVester2StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    let updatedVesting2Balance =
      await vester2StakeConnection.program.account.vestingBalance.fetch(
        vesting2Balance,
      );

    let updatedNewVestingBalance =
      await newVester3StakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );

    let updatedNewVesting2Balance =
      await newVester2StakeConnection.program.account.vestingBalance.fetch(
        newVesting2Balance,
      );

    assert.equal(
      updatedVesting2Balance.totalVestingBalance.toString(),
      "1016000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "2353000000",
    );
    assert.equal(updatedNewVesting2Balance.totalVestingBalance.toString(), "0");

    await sleep(2000);
    await vester2StakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vester: vester2.publicKey,
        vesterTa: vester2Ta,
        newVesterTa: newVester2Ta,
        vest: vest2NowForTransfer,
        vestingBalance: vesting2Balance,
        delegateStakeAccountCheckpoints:
          newVester3StakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: newVester3StakeAccountMetadataAddress,
        stakeAccountMetadata: vester2StakeAccountMetadataAddress,
        newDelegateStakeAccountCheckpoints:
          newVester2StakeAccountCheckpointsAddress,
        newDelegateStakeAccountMetadata: newVester2StakeAccountMetadataAddress,
        newStakeAccountMetadata: newVester2StakeAccountMetadataAddress,
        newVest: vestNowTransfered,
        newVestingBalance: newVesting2Balance,
        globalConfig: vester2StakeConnection.configAddress,
      })
      .signers([vester2])
      .rpc({ skipPreflight: true })
      .then(confirm);

    updatedVesting2Balance =
      await vester2StakeConnection.program.account.vestingBalance.fetch(
        vesting2Balance,
      );
    updatedNewVestingBalance =
      await newVester3StakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );
    updatedNewVesting2Balance =
      await newVester2StakeConnection.program.account.vestingBalance.fetch(
        newVesting2Balance,
      );

    assert.equal(updatedVesting2Balance.totalVestingBalance.toString(), "0");
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "2353000000",
    );
    assert.equal(
      updatedNewVesting2Balance.totalVestingBalance.toString(),
      "1016000000",
    );

    let vester2StakeMetadata: StakeAccountMetadata =
      await vester2StakeConnection.fetchStakeAccountMetadata(
        vester2StakeConnection.userPublicKey(),
      );
    let vester2StakeCheckpoints: CheckpointAccount =
      await vester2StakeConnection.fetchCheckpointAccount(
        vester2StakeAccountCheckpointsAddress,
      );
    let newVester3StakeCheckpoints: CheckpointAccount =
      await newVester3StakeConnection.fetchCheckpointAccount(
        newVester3StakeAccountCheckpointsAddress,
      );
    let newVester2StakeCheckpoints: CheckpointAccount =
      await newVester2StakeConnection.fetchCheckpointAccount(
        newVester2StakeAccountCheckpointsAddress,
      );

    assert.equal(vester2StakeMetadata.recordedVestingBalance.toString(), "0");
    assert.equal(vester2StakeMetadata.recordedBalance.toString(), "30000000");
    assert.equal(
      vester2StakeCheckpoints.getLastCheckpoint().value.toString(),
      "0",
    );
    assert.equal(
      newVester3StakeCheckpoints.getLastCheckpoint().value.toString(),
      "30000000",
    );
    assert.equal(
      newVester2StakeCheckpoints.getLastCheckpoint().value.toString(),
      "1036000000",
    );
  });

  it("should fail to claim staked vest with votes delegated to another user with incorrect accounts", async () => {
    let stakeAccountMetadataAddress =
      await newVester2StakeConnection.getStakeMetadataAddress(
        newVester2StakeConnection.userPublicKey(),
      );

    await sleep(2000);
    await newVester2StakeConnection.delegateWithVest(
      vester2StakeConnection.userPublicKey(),
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    let stakeAccountMetadataData =
      await newVester2StakeConnection.fetchStakeAccountMetadata(
        newVester2StakeConnection.userPublicKey(),
      );
    let delegateStakeAccountCheckpointsOwner =
      stakeAccountMetadataData.delegate;
    let delegateStakeAccountMetadataAddress =
      await newVester2StakeConnection.getStakeMetadataAddress(
        delegateStakeAccountCheckpointsOwner,
      );

    let delegateStakeAccountCheckpointsAddress =
      await newVester2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateStakeAccountMetadataAddress,
        false,
      );

    let newVest2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVester2Ta.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    try {
      await newVester2StakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vester: newVester2.publicKey,
          vesterTa: newVester2Ta,
          vest: newVest2,
          vestingBalance: newVesting2Balance,
          delegateStakeAccountCheckpoints:
            delegateStakeAccountCheckpointsAddress,
          delegateStakeAccountMetadata: stakeAccountMetadataAddress, // invalid delegateStakeAccountMetadata
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([newVester2])
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidStakeAccountOwner",
      );
    }

    let newVesterStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newVesterStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newVesterStakeAccountMetadataAddress,
        false,
      );

    try {
      await newVester2StakeConnection.program.methods
        .claimVesting()
        .accounts({
          ...accounts,
          vester: newVester2.publicKey,
          vesterTa: newVester2Ta,
          vest: newVest2,
          vestingBalance: newVesting2Balance,
          delegateStakeAccountCheckpoints:
            newVesterStakeAccountCheckpointsAddress, // invalid delegateStakeAccountCheckpoints
          delegateStakeAccountMetadata: delegateStakeAccountMetadataAddress,
          stakeAccountMetadata: stakeAccountMetadataAddress,
          globalConfig: stakeConnection.configAddress,
        })
        .signers([newVester2])
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

  it("should successfully claim staked vest with votes delegated to another user", async () => {
    let stakeAccountMetadataAddress =
      await newVester2StakeConnection.getStakeMetadataAddress(
        newVester2StakeConnection.userPublicKey(),
      );

    let stakeAccountMetadataData =
      await newVester2StakeConnection.fetchStakeAccountMetadata(
        newVester2StakeConnection.userPublicKey(),
      );
    let delegateStakeAccountCheckpointsOwner =
      stakeAccountMetadataData.delegate;
    let delegateStakeAccountMetadataAddress =
      await newVester2StakeConnection.getStakeMetadataAddress(
        delegateStakeAccountCheckpointsOwner,
      );

    let delegateStakeAccountCheckpointsAddress =
      await newVester2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateStakeAccountMetadataAddress,
        false,
      );

    let newVest2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVester2Ta.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    await sleep(2000);
    await newVester2StakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vester: newVester2.publicKey,
        vesterTa: newVester2Ta,
        vest: newVest2,
        vestingBalance: newVesting2Balance,
        delegateStakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: delegateStakeAccountMetadataAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([newVester2])
      .rpc()
      .then(confirm);

    let vesterStakeMetadata: StakeAccountMetadata =
      await newVester2StakeConnection.fetchStakeAccountMetadata(
        newVester2StakeConnection.userPublicKey(),
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await newVester2StakeConnection.fetchCheckpointAccount(
        delegateStakeAccountCheckpointsAddress,
      );

    assert.equal(vesterStakeMetadata.recordedVestingBalance.toString(), "0");
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "30000000",
    );
  });

  it("should successfully transfer vest to another vester with an existing vest of the same kind", async () => {
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
      "1658000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "2353000000",
    );

    await sleep(2000);
    await stakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vest: vestNowForTransfer3,
        delegateStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: stakeAccountMetadataAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        newDelegateStakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
        newDelegateStakeAccountMetadata: newStakeAccountMetadataAddress,
        newStakeAccountMetadata: newStakeAccountMetadataAddress,
        newVest: vestNowTransfered3,
        newVestingBalance: newVestingBalance,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([vester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    updatedVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        vestingBalance,
      );

    updatedNewVestingBalance =
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

    let vesterStakeMetadata: StakeAccountMetadata =
      await vesterStakeConnection.fetchStakeAccountMetadata(
        vesterStakeConnection.userPublicKey(),
      );

    let vesterStakeCheckpoints: CheckpointAccount =
      await vesterStakeConnection.fetchCheckpointAccount(
        stakeAccountCheckpointsAddress,
      );

    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "1437000000",
    );
    assert.equal(vesterStakeMetadata.recordedBalance.toString(), "40000000");
    assert.equal(
      vesterStakeCheckpoints.getLastCheckpoint().value.toString(),
      "1477000000",
    );
  });

  it("should successfully claim a vest after transfer", async () => {
    let vestNowTransfered = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
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

    await sleep(2000);
    await stakeConnection.program.methods
      .claimVesting()
      .accounts({
        ...accounts,
        vester: newVester.publicKey,
        vest: vestNowTransfered,
        vesterTa: newVesterTa,
        delegateStakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: stakeAccountMetadataAddress,
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
      "1658000000",
    );
  });

  it("should successfully create vesting balance and transfer vest to another vester without balance", async () => {
    let newVesterStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        newVesterStakeConnection.userPublicKey(),
      );
    let newVesterStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        newVesterStakeAccountMetadataAddress,
        false,
      );

    if (newVesterStakeAccountCheckpointsAddress == undefined) {
      let previousNewVesterStakeAccountCheckpointsAddress =
        await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          newVesterStakeAccountMetadataAddress,
          true,
        );

      let previousNewVesterStakeCheckpoints: CheckpointAccount =
        await newVesterStakeConnection.fetchCheckpointAccount(
          previousNewVesterStakeAccountCheckpointsAddress,
        );

      // previous checkpoint account is filled
      assert.equal(
        previousNewVesterStakeCheckpoints.getCheckpointCount(),
        TINY_CHECKPOINTS_ACCOUNT_LIMIT,
      );

      await sleep(2000);
      await stakeConnection.program.methods
        .createCheckpoints()
        .accounts({
          payer: accounts.vester,
          stakeAccountCheckpoints:
            previousNewVesterStakeAccountCheckpointsAddress,
          stakeAccountMetadata: newVesterStakeAccountMetadataAddress,
        })
        .signers([vester])
        .rpc({ skipPreflight: true })
        .then(confirm);

      newVesterStakeAccountCheckpointsAddress =
        await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          newVesterStakeAccountMetadataAddress,
          false,
        );
    }

    await sleep(2000);
    // transfer vestLaterForTransfer from newVester to vesterWithoutAccount
    await stakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vester: newVester.publicKey,
        vesterTa: newVesterTa,
        vestingBalance: newVestingBalance,
        vest: vestLaterForTransfer,
        delegateStakeAccountCheckpoints:
          newVesterStakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: newVesterStakeAccountMetadataAddress,
        stakeAccountMetadata: newVesterStakeAccountMetadataAddress,
        // Instead of null we pass any existing CheckpointData and StakeAccountMetadata accounts,
        // because otherwise we have an error
        // "Access violation in unknown section at address 0x8 of size 8"
        // related to the lack of memory on the stack
        newDelegateStakeAccountCheckpoints:
          newVesterStakeAccountCheckpointsAddress,
        newDelegateStakeAccountMetadata: newVesterStakeAccountMetadataAddress,
        newStakeAccountMetadata: newVesterStakeAccountMetadataAddress,
        newVestingBalance: vestingBalanceWithoutAccount,
        newVesterTa: vesterTaWithoutAccount,
        globalConfig: stakeConnection.configAddress,
      })
      .signers([newVester])
      .rpc({ skipPreflight: true })
      .then(confirm);

    let updatedVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );

    let updatedNewVestingBalance =
      await stakeConnection.program.account.vestingBalance.fetch(
        vestingBalanceWithoutAccount,
      );

    assert.equal(
      updatedVestingBalance.totalVestingBalance.toString(),
      "642000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "1016000000",
    );
    assert.equal(
      updatedNewVestingBalance.vester.toString("hex"),
      vesterWithoutAccount.publicKey.toString("hex"),
    );
  });

  it("should keep checkpoints unchanged when transfer vest if the delegate does not change", async () => {
    let stakeAccountMetadataAddress =
      await vester3StakeConnection.getStakeMetadataAddress(
        vester3StakeConnection.userPublicKey(),
      );

    let stakeAccountCheckpointsAddress =
      await vester3StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
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

    // vester3 to delegate to the same delegateOwner as newVester
    let delegateOwner = await newVesterStakeConnection.delegates(
      newVesterStakeConnection.userPublicKey(),
    );
    await sleep(2000);
    await vester3StakeConnection.delegateWithVest(
      delegateOwner,
      WHTokenBalance.fromString("10"),
      true,
      config,
    );

    let updatedVesting3Balance =
      await vester3StakeConnection.program.account.vestingBalance.fetch(
        vesting3Balance,
      );
    let updatedNewVestingBalance =
      await newVesterStakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );
    assert.equal(
      updatedVesting3Balance.totalVestingBalance.toString(),
      "1016000000",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "642000000",
    );

    let delegateOwnerStakeAccountMetadataAddress =
      await newVesterStakeConnection.getStakeMetadataAddress(
        delegateOwner,
      );
    let delegateOwnerStakeAccountCheckpointsAddress =
      await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        delegateOwnerStakeAccountMetadataAddress,
        false,
      );
    if (delegateOwnerStakeAccountCheckpointsAddress == undefined) {
      let previousDelegateOwnerStakeAccountCheckpointsAddress =
        await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          delegateOwnerStakeAccountMetadataAddress,
          true,
        );
      let previousDelegateOwnerStakeAccountCheckpoints: CheckpointAccount =
        await newVesterStakeConnection.fetchCheckpointAccount(
          previousDelegateOwnerStakeAccountCheckpointsAddress,
        );

      // previous checkpoint account is filled
      assert.equal(
        previousDelegateOwnerStakeAccountCheckpoints.getCheckpointCount(),
        TINY_CHECKPOINTS_ACCOUNT_LIMIT,
      );

      await sleep(2000);
      await vester3StakeConnection.program.methods
        .createCheckpoints()
        .accounts({
          payer: accounts.vester,
          stakeAccountCheckpoints:
            previousDelegateOwnerStakeAccountCheckpointsAddress,
          stakeAccountMetadata: delegateOwnerStakeAccountMetadataAddress,
        })
        .signers([vester])
        .rpc({ skipPreflight: true })
        .then(confirm);

      delegateOwnerStakeAccountCheckpointsAddress =
        await newVesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          delegateOwnerStakeAccountMetadataAddress,
          false,
        );
    }

    let delegateOwnerStakeAccountCheckpoints: CheckpointAccount =
      await newVesterStakeConnection.fetchCheckpointAccount(
        delegateOwnerStakeAccountCheckpointsAddress,
      );
    let checkpointCountBeforeTransferVesting = delegateOwnerStakeAccountCheckpoints.getCheckpointCount()
    assert.equal(
      delegateOwnerStakeAccountCheckpoints.getLastCheckpoint().value.toString(),
      "2694000000",
    );

    let newVest = PublicKey.findProgramAddressSync(
      [
        Buffer.from(wasm.Constants.VEST_SEED()),
        config.toBuffer(),
        newVesterTa.toBuffer(),
        FEW_LATER.toBuffer("le", 8),
      ],
      stakeConnection.program.programId,
    )[0];

    await vester3StakeConnection.program.methods
      .transferVesting()
      .accounts({
        ...accounts,
        vester: vester3StakeConnection.userPublicKey(),
        vesterTa: vester3Ta,
        vestingBalance: vesting3Balance,
        vest: vest3NowForTransfer,
        delegateStakeAccountCheckpoints: delegateOwnerStakeAccountCheckpointsAddress,
        delegateStakeAccountMetadata: delegateOwnerStakeAccountMetadataAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
        newDelegateStakeAccountCheckpoints: delegateOwnerStakeAccountCheckpointsAddress,
        newDelegateStakeAccountMetadata: delegateOwnerStakeAccountMetadataAddress,
        newStakeAccountMetadata: newStakeAccountMetadataAddress,
        newVest: newVest,
        newVestingBalance: newVestingBalance,
        newVesterTa: newVesterTa,
        globalConfig: vester3StakeConnection.configAddress,
      })
      .rpc({ skipPreflight: true })
      .then(confirm);

    updatedVesting3Balance =
      await vester3StakeConnection.program.account.vestingBalance.fetch(
        vesting3Balance,
      );
    updatedNewVestingBalance =
      await vester3StakeConnection.program.account.vestingBalance.fetch(
        newVestingBalance,
      );
    assert.equal(
      updatedVesting3Balance.totalVestingBalance.toString(),
      "0",
    );
    assert.equal(
      updatedNewVestingBalance.totalVestingBalance.toString(),
      "1658000000",
    );

    let vesterStakeMetadata: StakeAccountMetadata =
      await newVesterStakeConnection.fetchStakeAccountMetadata(
        newVesterStakeConnection.userPublicKey(),
      );
    assert.equal(
      vesterStakeMetadata.recordedVestingBalance.toString(),
      "2674000000",
    );

    delegateOwnerStakeAccountCheckpoints: CheckpointAccount =
      await newVesterStakeConnection.fetchCheckpointAccount(
        delegateOwnerStakeAccountCheckpointsAddress,
      );
    assert.equal(
      delegateOwnerStakeAccountCheckpoints.getCheckpointCount().toString(),
      checkpointCountBeforeTransferVesting.toString(),
    );
    assert.equal(
      delegateOwnerStakeAccountCheckpoints.getLastCheckpoint().value.toString(),
      "2694000000",
    );
  });
});
