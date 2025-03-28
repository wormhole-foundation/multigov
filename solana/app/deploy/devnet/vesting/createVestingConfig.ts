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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  console.log(
    `NOW: ${NOW.toString()} (${new Date(NOW.toNumber() * 1000).toISOString()})`,
  );
  console.log(
    `LATER: ${LATER.toString()} (${new Date(LATER.toNumber() * 1000).toISOString()})`,
  );
  console.log(
    `EVEN_LATER: ${EVEN_LATER.toString()} (${new Date(EVEN_LATER.toNumber() * 1000).toISOString()})`,
  );

  const seed = new BN(randomBytes(8));
  console.log("Vesting config random seed:", seed);
  const seedBuffer = seed.toBuffer("le", 8);
  console.log("seedBuffer:", seedBuffer);
  console.log("seedBufferHex:", seedBuffer.toString("hex"));

  const config = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
      WORMHOLE_TOKEN.toBuffer(),
      seedBuffer,
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
  await sleep(3000);

  console.log("Creating vesting balance for vester...");
  await stakeConnection.program.methods
    .createVestingBalance(vester.publicKey)
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log("Vesting balance for vester created");
  await sleep(3000);

  console.log(`Creating vest for vester at NOW (${NOW.toString()})...`);
  await stakeConnection.program.methods
    .createVesting(vester.publicKey, NOW, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at NOW (${NOW.toString()}) created`);
  await sleep(3000);

  console.log(`Creating vest for vester at LATER (${LATER.toString()})...`);
  await stakeConnection.program.methods
    .createVesting(vester.publicKey, LATER, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at LATER (${LATER.toString()}) created`);
  await sleep(3000);

  console.log(
    `Creating vest for vester at EVEN_LATER (${EVEN_LATER.toString()})...`,
  );
  await stakeConnection.program.methods
    .createVesting(vester.publicKey, EVEN_LATER, new BN(20e6))
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(
    `Vest for vester at EVEN_LATER (${EVEN_LATER.toString()}) created`,
  );
  await sleep(3000);

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
    .cancelVesting(vester.publicKey)
    .accountsPartial({ ...accounts, vest: vestLater })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log(`Vest for vester at LATER (${LATER.toString()}) canceled`);
  await sleep(3000);

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
  await sleep(3000);

  console.log("Withdrawing surplus...");
  await stakeConnection.program.methods
    .withdrawSurplus()
    .accounts({ ...accounts })
    .signers([admin])
    .rpc()
    .then(confirm);
  console.log("Surplus withdrawn");
  await sleep(3000);

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
