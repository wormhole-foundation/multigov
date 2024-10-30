import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import { STAKING_ADDRESS } from "../constants";
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
    freeze: false,
    governanceAuthority: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    whTokenMint: WORMHOLE_TOKEN,
    vestingAdmin: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
  };
  await program.methods.initConfig(globalConfig).rpc();
}

main();
