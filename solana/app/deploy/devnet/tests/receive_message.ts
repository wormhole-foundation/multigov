import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  AccountMeta,
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  CORE_BRIDGE_PID,
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE
} from "../constants";
import { Staking } from "../../../../target/types/staking";
import fs from "fs";
import BN from "bn.js";
import {
  hubSolanaMessageDispatcherPublicKey,
  HUB_CHAIN_ID,
} from "../constants";

async function main() {
  try {
    // TODO set POSTED_VAA_ADDRESS
    const POSTED_VAA_ADDRESS: PublicKey = new PublicKey("");
    // TODO update REMAINING_ACCOUNTS
    const REMAINING_ACCOUNTS: AccountMeta[] = [
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: new PublicKey("3kN6zirjBNLXofyMv268uDP2nxVHKN4HJ5esCVbh1LU7"),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: new PublicKey("3Pe7YqWdD9Pj8ejb7ex2j7nuKpPhtGR8yktxQGZ8SgQa"),
        isWritable: false,
        isSigner: false,
      },
    ];
    const DEBUG = true;
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {},
    );

    let program: Program<Staking>;
    program = new Program(
      JSON.parse(fs.readFileSync("./target/idl/staking.json").toString()),
      provider,
    );

    const airlockPDA: PublicKey = PublicKey.findProgramAddressSync(
      [Buffer.from("airlock")],
      program.programId,
    )[0];

    const messageExecutorPDA: PublicKey = PublicKey.findProgramAddressSync(
      [Buffer.from("spoke_message_executor")],
      program.programId,
    )[0];

    // Prepare the messageReceivedPDA seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(HUB_CHAIN_ID);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = hubSolanaMessageDispatcherPublicKey.toBuffer();

    // TODO use sequence from real VAA
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(BigInt(1), 0);

    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      program.programId,
    );

    // Invoke receive_message instruction
    await program.methods
      .receiveMessage(new BN(100000000))
      .accounts({
        payer: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
        // @ts-ignore
        messageReceived: messageReceivedPDA,
        airlock: airlockPDA,
        messageExecutor: messageExecutorPDA,
        postedVaa: POSTED_VAA_ADDRESS,
        wormholeProgram: CORE_BRIDGE_PID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(REMAINING_ACCOUNTS)
      .rpc({ skipPreflight: DEBUG });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
