// Usage: npx ts-node app/deploy/065_fetchSpokeMessageExecutor.ts

import { Wallet, AnchorProvider, utils } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE
} from "./devnet_consts";
import {
  STAKING_ADDRESS,
  HUB_CHAIN_ID,
  hubSolanaMessageDispatcherPublicKey,
} from "../constants";
import { StakeConnection } from "../StakeConnection";

async function main() {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
    {},
  );
  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
    STAKING_ADDRESS,
  );

  console.log("HUB_CHAIN_ID:", HUB_CHAIN_ID);
  console.log("hubSolanaMessageDispatcherPublicKey:", hubSolanaMessageDispatcherPublicKey);

  const [spokeMessageExecutorAccountAddress, _] = PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(wasm.Constants.SPOKE_MESSAGE_EXECUTOR_SEED())],
    stakeConnection.program.programId,
  );
  console.log("spokeMessageExecutorAccountAddress:", spokeMessageExecutorAccountAddress);

  let spokeMessageExecutorAccountData =
    await stakeConnection.program.account.spokeMessageExecutor.fetch(spokeMessageExecutorAccountAddress);
  console.log("spokeMessageExecutorAccountData:", spokeMessageExecutorAccountData);
}

main();
