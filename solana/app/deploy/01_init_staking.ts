// Usage: npx ts-node app/deploy/01_init_staking.ts

import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import { CHECKPOINTS_ACCOUNT_LIMIT, STAKING_ADDRESS } from "../constants";
import { Staking } from "../../target/types/staking";
import fs from "fs";

async function main() {
  const client = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    client,
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
