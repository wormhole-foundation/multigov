// Usage: npx ts-node app/deploy/devnet/tests/21_fetchGlobalConfig.ts

import { Wallet, AnchorProvider, utils } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  CHECKPOINTS_ACCOUNT_LIMIT,
  DEPLOYER_AUTHORITY_KEYPAIR,
  WORMHOLE_TOKEN,
  GOVERNANCE_AUTHORITY_KEYPAIR,
  VESTING_ADMIN_KEYPAIR,
  RPC_NODE,
} from "../constants";
import { StakeConnection } from "../../../StakeConnection";

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
  );

  console.log("DEPLOYER_AUTHORITY_KEYPAIR.publicKey:", DEPLOYER_AUTHORITY_KEYPAIR.publicKey);
  console.log("WORMHOLE_TOKEN.publicKey:", WORMHOLE_TOKEN);
  console.log("GOVERNANCE_AUTHORITY_KEYPAIR.publicKey:", GOVERNANCE_AUTHORITY_KEYPAIR.publicKey);
  console.log("VESTING_ADMIN_KEYPAIR.publicKey:", VESTING_ADMIN_KEYPAIR.publicKey);
  console.log("CHECKPOINTS_ACCOUNT_LIMIT:", CHECKPOINTS_ACCOUNT_LIMIT);

  const [configAccount, bump] = PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
    stakeConnection.program.programId,
  );
  console.log("bump:", bump);
  console.log("configAccount:", configAccount);

  let configAccountData =
    await stakeConnection.program.account.globalConfig.fetch(configAccount);
  console.log("configAccountData:", configAccountData);
}

main();
