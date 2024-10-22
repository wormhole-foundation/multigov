import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, USER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import { STAKING_ADDRESS } from "../constants";
import { StakeConnection } from "../StakeConnection";
import { WHTokenBalance } from "../whTokenBalance";
import BN from "bn.js";
import { randomBytes } from "crypto";
import * as wasm from "@wormhole/staking-wasm";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

async function main() {
  const admin = DEPLOYER_AUTHORITY_KEYPAIR;
  const vester = USER_AUTHORITY_KEYPAIR;

  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(admin),
    {},
  );
  const vesterProvider = new AnchorProvider(
    connection,
    new Wallet(vester),
    {},
  );

  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
    STAKING_ADDRESS,
  );
  const vesterStakeConnection = await StakeConnection.createStakeConnection(
    connection,
    vesterProvider.wallet as Wallet,
    STAKING_ADDRESS,
  );

  const confirm = async (signature: string): Promise<string> => {
    const block =
      await stakeConnection.provider.connection.getLatestBlockhash();
    await stakeConnection.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  };

  const NOW = new BN(Math.floor(new Date().getTime() / 1000));
  const LATER = NOW.add(new BN(1000));
  const EVEN_LATER = LATER.add(new BN(1000));

  const seed = new BN(randomBytes(8));
  const config = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
      admin.publicKey.toBuffer(),
      WORMHOLE_TOKEN.toBuffer(),
      seed.toBuffer("le", 8),
    ],
    stakeConnection.program.programId,
  )[0];
  const vault = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    config,
    true,
    TOKEN_PROGRAM_ID,
  );

  const vesterTa = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    vester.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  const adminAta = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    admin.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );

  const vestNow = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VEST_SEED()),
      config.toBuffer(),
      vesterTa.toBuffer(),
      NOW.toBuffer("le", 8),
    ],
    stakeConnection.program.programId,
  )[0];
  const vestLater = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VEST_SEED()),
      config.toBuffer(),
      vesterTa.toBuffer(),
      LATER.toBuffer("le", 8),
    ],
    stakeConnection.program.programId,
  )[0];

  const vestingBalance = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
      config.toBuffer(),
      vester.publicKey.toBuffer(),
    ],
    stakeConnection.program.programId,
  )[0];

  let adminStakeAccountCheckpointsAddress =
    await stakeConnection.getStakeAccountCheckpointsAddress(admin.publicKey);
  if (!adminStakeAccountCheckpointsAddress) {
    await stakeConnection.createStakeAccount();
  }

  let vesterStakeAccountCheckpointsAddress =
    await vesterStakeConnection.getStakeAccountCheckpointsAddress(vester.publicKey);
  if (!vesterStakeAccountCheckpointsAddress) {
    await vesterStakeConnection.createStakeAccount();
  }

  let accounts = {
    admin: admin.publicKey,
    payer: admin.publicKey,
    mint: WORMHOLE_TOKEN,
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

  await stakeConnection.program.methods
    .initializeVestingConfig(seed)
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);

  await stakeConnection.program.methods
    .createVestingBalance()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);

  await stakeConnection.program.methods
    .createVesting(NOW, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc({
      skipPreflight: true,
    })
    .then(confirm);

  await stakeConnection.program.methods
    .createVesting(LATER, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);

  await stakeConnection.program.methods
    .createVesting(EVEN_LATER, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);

  await stakeConnection.program.methods
    .cancelVesting()
    .accountsPartial({ ...accounts, vest: vestLater })
    .signers([admin])
    .rpc()
    .then(confirm);

  const tx = new Transaction();
  tx.add(
    createTransferCheckedInstruction(
      adminAta,
      WORMHOLE_TOKEN,
      vault,
      admin.publicKey,
      50e6,
      6,
      undefined,
      TOKEN_PROGRAM_ID,
    ),
  );
  await stakeConnection.provider.sendAndConfirm(tx, [admin]);

  await stakeConnection.program.methods
    .withdrawSurplus()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);

  await stakeConnection.program.methods
    .finalizeVestingConfig()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);

  let stakeAccountCheckpointsAddress =
    await vesterStakeConnection.delegate_with_vest(
      vester.publicKey,
      WHTokenBalance.fromString("0"),
      true,
      config,
    );

  let stakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(
      stakeAccountCheckpointsAddress,
    );

  await stakeConnection.program.methods
    .claimVesting()
    .accountsPartial({
      ...accounts,
      vest: vestNow,
      stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
      stakeAccountMetadata: stakeAccountMetadataAddress,
      globalConfig: stakeConnection.configAddress,
    })
    .signers([vester])
    .rpc({ skipPreflight: true })
    .then(confirm);
}

main();
