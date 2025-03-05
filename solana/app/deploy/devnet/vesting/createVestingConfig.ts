// Usage: npx ts-node app/deploy/devnet/vesting/createVestingConfig.ts

import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  VESTING_ADMIN_KEYPAIR,
  USER_AUTHORITY_KEYPAIR,
  WORMHOLE_TOKEN,
  RPC_NODE,
} from "../constants";
import { StakeConnection } from "../../../StakeConnection";
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
  const admin = VESTING_ADMIN_KEYPAIR;
  const vester = USER_AUTHORITY_KEYPAIR;

  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(connection, new Wallet(admin), {});

  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
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
  console.log("Vesting claim times:");
  console.log(`NOW: ${NOW.toString()} (${new Date(NOW.toNumber() * 1000).toISOString()})`);
  console.log(`LATER: ${LATER.toString()} (${new Date(LATER.toNumber() * 1000).toISOString()})`);
  console.log(`EVEN_LATER: ${EVEN_LATER.toString()} (${new Date(EVEN_LATER.toNumber() * 1000).toISOString()})`);

  const seed = new BN(randomBytes(8));
  console.log("Vesting config random seed:", seed);
  const config = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
      WORMHOLE_TOKEN.toBuffer(),
      seed.toBuffer("le", 8),
    ],
    stakeConnection.program.programId,
  )[0];
  console.log("Vesting config account:", config);

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

  const vestingBalance = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
      config.toBuffer(),
      vester.publicKey.toBuffer(),
    ],
    stakeConnection.program.programId,
  )[0];
  console.log("Vesting balance account for vester:", vestingBalance);

  let accounts = {
    admin: admin.publicKey,
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
    vestingBalance,
  };

  console.log("Initializing vesting config...");
  await stakeConnection.program.methods
    .initializeVestingConfig(seed)
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log("Vesting config initialized");

  console.log("Creating vesting balance for vester...");
  await stakeConnection.program.methods
    .createVestingBalance()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log("Vesting balance for vester created");

  console.log(`Creating vest for vester at NOW (${NOW.toString()})...`);
  await stakeConnection.program.methods
    .createVesting(NOW, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at NOW (${NOW.toString()}) created`);

  console.log(`Creating vest for vester at LATER (${LATER.toString()})...`);
  await stakeConnection.program.methods
    .createVesting(LATER, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at LATER (${LATER.toString()}) created`);

  console.log(`Creating vest for vester at EVEN_LATER (${EVEN_LATER.toString()})...`);
  await stakeConnection.program.methods
    .createVesting(EVEN_LATER, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at EVEN_LATER (${EVEN_LATER.toString()}) created`);

  const vestLater = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VEST_SEED()),
      config.toBuffer(),
      vesterTa.toBuffer(),
      LATER.toBuffer("le", 8),
    ],
    stakeConnection.program.programId,
  )[0];

  console.log(`Canceling vest for vester at LATER (${LATER.toString()})...`);
  await stakeConnection.program.methods
    .cancelVesting()
    .accountsPartial({ ...accounts, vest: vestLater })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at LATER (${LATER.toString()}) canceled`);

  console.log("Transferring WH tokens to Vault...");
  const tx = new Transaction();
  tx.add(
    createTransferCheckedInstruction(
      adminAta,
      WORMHOLE_TOKEN,
      vault,
      admin.publicKey,
      100e6,
      6,
      undefined,
      TOKEN_PROGRAM_ID,
    ),
  );
  await stakeConnection.provider.sendAndConfirm(tx, [admin]);
  console.log("WH tokens transferred to Vault");

  console.log("Withdrawing surplus...");
  await stakeConnection.program.methods
    .withdrawSurplus()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log("Surplus withdrawn");

  console.log("Finalizing vesting config...");
  await stakeConnection.program.methods
    .finalizeVestingConfig()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log("Vesting config finalized");
}

main();
