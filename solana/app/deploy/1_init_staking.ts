import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./devnet";
import { STAKING_ADDRESS } from "../constants";

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
    governanceAuthority: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    whTokenMint: WORMHOLE_TOKEN,
    freeze: false,
    pdaAuthority: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    agreementHash: Array.from(Buffer.alloc(0)),
  };
  await program.methods.initConfig(globalConfig).rpc();
}

main();
