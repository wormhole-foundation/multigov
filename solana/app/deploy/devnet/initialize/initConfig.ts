// Usage: npx ts-node app/deploy/devnet/initialize/initConfig.ts

import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import {
  CHECKPOINTS_ACCOUNT_LIMIT,
  STAKING_ADDRESS,
  DEPLOYER_AUTHORITY_KEYPAIR,
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
    governanceAuthority: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    votingTokenMint: WORMHOLE_TOKEN,
    vestingAdmin: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    maxCheckpointsAccountLimit: CHECKPOINTS_ACCOUNT_LIMIT,
  };
  await program.methods.initConfig(globalConfig).rpc();
}

main();
