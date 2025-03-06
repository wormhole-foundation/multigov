// Usage: npx ts-node app/deploy/mainnet/initialize/initConfig.ts

import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import {
  CHECKPOINTS_ACCOUNT_LIMIT,
  STAKING_ADDRESS,
  DEPLOYER_AUTHORITY_KEYPAIR,
  GOVERNANCE_AUTHORITY_KEYPAIR,
  VESTING_ADMIN_KEYPAIR,
  WORMHOLE_TOKEN,
  RPC_NODE,
} from "../constants";

async function main() {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
    {},
  );

  const idl = (await Program.fetchIdl(STAKING_ADDRESS, provider))!;
  const program = new Program(idl, provider);

  const globalConfig = {
    bump: 255,
    governanceAuthority: GOVERNANCE_AUTHORITY_KEYPAIR.publicKey,
    votingTokenMint: WORMHOLE_TOKEN,
    vestingAdmin: VESTING_ADMIN_KEYPAIR.publicKey,
    maxCheckpointsAccountLimit: CHECKPOINTS_ACCOUNT_LIMIT,
  };
  await program.methods.initConfig(globalConfig).rpc();
}

main();
