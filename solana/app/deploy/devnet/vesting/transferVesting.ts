// Usage: npx ts-node app/deploy/devnet/vesting/transferVesting.ts

import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  VESTING_ADMIN_KEYPAIR,
  USER_AUTHORITY_KEYPAIR,
  USER2_AUTHORITY_KEYPAIR,
  WORMHOLE_TOKEN,
  RPC_NODE,
} from "../constants";
import { StakeAccountMetadata, StakeConnection } from "../../../StakeConnection";
import BN from "bn.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { CheckpointAccount } from "../../../checkpoints";
import { WHTokenBalance } from "../../../whTokenBalance";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const admin = VESTING_ADMIN_KEYPAIR;
  const vester = USER_AUTHORITY_KEYPAIR;
  const newVester = USER2_AUTHORITY_KEYPAIR;

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

  const EVEN_LATER = new BN(1741272829);
  const config = new PublicKey("AHfPLNVnRGoACwMfoRCwWnCEJWjMX4x7Yq3ufg3tpjQQ");

  const vesterTa = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    vester.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  const newVesterTa = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    newVester.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  const adminAta = getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    admin.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );

  const vestEvenLater = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VEST_SEED()),
      config.toBuffer(),
      vesterTa.toBuffer(),
      EVEN_LATER.toBuffer("le", 8),
    ],
    vesterStakeConnection.program.programId,
  )[0];
  const newVestEvenLater = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VEST_SEED()),
      config.toBuffer(),
      newVesterTa.toBuffer(),
      EVEN_LATER.toBuffer("le", 8),
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
  const newVestingBalance = PublicKey.findProgramAddressSync(
    [
      Buffer.from(wasm.Constants.VESTING_BALANCE_SEED()),
      config.toBuffer(),
      newVester.publicKey.toBuffer(),
    ],
    vesterStakeConnection.program.programId,
  )[0];

  let stakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(
      vester.publicKey
    );
//   console.log("stakeAccountMetadataAddress:", stakeAccountMetadataAddress)
  let newStakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(
      newVester.publicKey,
    );

  let vestingBalanceAccount =
    await vesterStakeConnection.program.account.vestingBalance.fetch(
      vestingBalance,
    );
  console.log("vestingBalanceAccount.totalVestingBalance: ", vestingBalanceAccount.totalVestingBalance.toString())

  let vesterDelegateStakeAccountOwner = await vesterStakeConnection.delegates(
    vester.publicKey,
  );
  let vesterDelegateStakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(
      vesterDelegateStakeAccountOwner,
    );
  let vesterDelegateStakeAccountCheckpointsAddress =
    await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
      vesterDelegateStakeAccountMetadataAddress,
      false,
    );

  let newVesterDelegateStakeAccountOwner =
    await vesterStakeConnection.delegates(newVester.publicKey);
  let newVesterDelegateStakeAccountMetadataAddress =
    await vesterStakeConnection.getStakeMetadataAddress(
      newVesterDelegateStakeAccountOwner,
    );
  let newVesterDelegateStakeAccountCheckpointsAddress =
    await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
      newVesterDelegateStakeAccountMetadataAddress,
      false,
    );

  let accounts = {
    vester: vester.publicKey,
    mint: WORMHOLE_TOKEN,
    vesterTa,
    newVesterTa,
    config,
    vest: vestEvenLater,
    newVest: newVestEvenLater,
    vestingBalance,
    newVestingBalance,
    globalConfig: vesterStakeConnection.configAddress,
    delegateStakeAccountCheckpoints: newVesterDelegateStakeAccountCheckpointsAddress,
    delegateStakeAccountMetadata: newVesterDelegateStakeAccountMetadataAddress,
    stakeAccountMetadata: stakeAccountMetadataAddress,
    newStakeAccountMetadata: null,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  console.log("Starting transferVesting...");
  let tx = new Transaction();
  tx.instructions = [
    await vesterStakeConnection.program.methods
      .delegate(
        newVesterDelegateStakeAccountOwner,
        vesterDelegateStakeAccountOwner,
      )
      .accountsPartial({
        payer: vester.publicKey,
        currentDelegateStakeAccountCheckpoints:
          vesterDelegateStakeAccountCheckpointsAddress,
        delegateeStakeAccountCheckpoints:
          newVesterDelegateStakeAccountCheckpointsAddress,
        vestingConfig: config,
        vestingBalance: vestingBalance,
        mint: WORMHOLE_TOKEN,
      })
      .instruction(),
    await vesterStakeConnection.program.methods
      .transferVesting()
      .accountsPartial({ ...accounts })
      .instruction(),
    await vesterStakeConnection.program.methods
      .delegate(
        vesterDelegateStakeAccountOwner,
        newVesterDelegateStakeAccountOwner,
      )
      .accountsPartial({
        payer: vester.publicKey,
        currentDelegateStakeAccountCheckpoints:
          newVesterDelegateStakeAccountCheckpointsAddress,
        delegateeStakeAccountCheckpoints:
          vesterDelegateStakeAccountCheckpointsAddress,
        vestingConfig: config,
        vestingBalance: vestingBalance,
        mint: WORMHOLE_TOKEN,
      })
      .instruction(),
  ];
  await vesterStakeConnection.provider.sendAndConfirm(tx, [vester]);
  console.log("transferVesting completed successfully.");

//   console.log(`Delegate WH tokens with vests`);
//   await vesterStakeConnection.delegateWithVest(
//     newVesterDelegateStakeAccountOwner,
//     WHTokenBalance.fromString("0"),
//     true,
//     config,
//   );
//   console.log(`WH tokens with vests successfully delegated`);
//   await sleep(3000);
//
//   console.log("Starting transferVesting...");
//     await vesterStakeConnection.program.methods
//       .transferVesting()
//       .accountsPartial({
//         ...accounts
//       })
//       .rpc()
//       .then(confirm);
//   console.log("transferVesting completed successfully.");
//   await sleep(3000);
// 
//   console.log(`Delegate WH tokens with vests`);
//   await vesterStakeConnection.delegateWithVest(
//     vesterDelegateStakeAccountOwner,
//     WHTokenBalance.fromString("0"),
//     true,
//     config,
//   );
//   console.log(`WH tokens with vests successfully delegated`);

  vestingBalanceAccount =
    await vesterStakeConnection.program.account.vestingBalance.fetch(
      vestingBalance,
    );
  let newVestingBalanceAccount =
    await vesterStakeConnection.program.account.vestingBalance.fetch(
      newVestingBalance,
    );
  console.log("vestingBalanceAccount.totalVestingBalance: ", vestingBalanceAccount.totalVestingBalance.toString())
  console.log("newVestingBalanceAccount.totalVestingBalance: ", newVestingBalanceAccount.totalVestingBalance.toString())

  let vesterStakeMetadata: StakeAccountMetadata =
    await vesterStakeConnection.fetchStakeAccountMetadata(vester.publicKey);
  let stakeAccountCheckpointsAddress =
    await vesterStakeConnection.getStakeAccountCheckpointsAddressByMetadata(
      stakeAccountMetadataAddress,
      false,
    );

  console.log("vesterStakeMetadata.recordedVestingBalance: ", vesterStakeMetadata.recordedVestingBalance.toString())
  console.log("vesterStakeMetadata.recordedBalance: ", vesterStakeMetadata.recordedBalance.toString())
}

main();
