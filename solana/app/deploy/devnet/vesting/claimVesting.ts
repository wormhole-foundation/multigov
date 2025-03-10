// Usage: npx ts-node app/deploy/devnet/vesting/claimVesting.ts

import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  VESTING_ADMIN_KEYPAIR,
  USER_AUTHORITY_KEYPAIR,
  WORMHOLE_TOKEN,
  RPC_NODE,
} from "../constants";
import { StakeConnection } from "../../../StakeConnection";
import BN from "bn.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

async function main() {
  const admin = VESTING_ADMIN_KEYPAIR;
  const vester = USER_AUTHORITY_KEYPAIR;

  const connection = new Connection(RPC_NODE);
  const vesterProvider = new AnchorProvider(connection, new Wallet(vester), {});
  const vesterStakeConnection = await StakeConnection.createStakeConnection(
    connection,
    vesterProvider.wallet as Wallet,
  );

  const confirm = async (signature: string): Promise<string> => {
    const block =
      await vesterStakeConnection.provider.connection.getLatestBlockhash();
    await vesterStakeConnection.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  };

  const NOW = new BN(1741270829);

  const seedBufferHex = "83cda9d4e2445bff";
  const seedBuffer = Buffer.from(seedBufferHex, "hex");
  const config = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_CONFIG_SEED()),
      WORMHOLE_TOKEN.toBuffer(),
      seedBuffer,
    ],
    vesterStakeConnection.program.programId,
  )[0];
  //   const config = new PublicKey("AHfPLNVnRGoACwMfoRCwWnCEJWjMX4x7Yq3ufg3tpjQQ");
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

  const vestNow = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VEST_SEED()),
      config.toBuffer(),
      vesterTa.toBuffer(),
      NOW.toBuffer("le", 8),
    ],
    vesterStakeConnection.program.programId,
  )[0];

  const vestingBalance = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
      config.toBuffer(),
      vester.publicKey.toBuffer(),
    ],
    vesterStakeConnection.program.programId,
  )[0];

  let stakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(vester.publicKey);
  let stakeAccountMetadataData =
    await vesterStakeConnection.fetchStakeAccountMetadata(vester.publicKey);
  let delegateStakeAccountCheckpointsOwner = stakeAccountMetadataData.delegate;
  let delegateStakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(
      delegateStakeAccountCheckpointsOwner,
    );
  let delegateStakeAccountCheckpointsAddress =
    await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
      delegateStakeAccountMetadataAddress,
      false,
    );

  let accounts = {
    vester: vester.publicKey,
    mint: WORMHOLE_TOKEN,
    vault,
    vesterTa,
    config,
    vest: vestNow,
    vestingBalance,
    delegateStakeAccountCheckpoints: delegateStakeAccountCheckpointsAddress,
    delegateStakeAccountMetadata: stakeAccountMetadataAddress,
    stakeAccountMetadata: stakeAccountMetadataAddress,
    globalConfig: vesterStakeConnection.configAddress,
    admin: admin.publicKey,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  console.log("Starting claimVesting...");
  await vesterStakeConnection.program.methods
    .claimVesting()
    .accountsPartial({ ...accounts })
    .signers([vester])
    .rpc()
    .then(confirm);
  console.log("claimVesting completed successfully.");
}

main();
