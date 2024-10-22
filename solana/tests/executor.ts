import { BN } from "@coral-xyz/anchor";
import path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ethers } from "ethers";
import assert from "assert";
import { StakeConnection } from "../app/StakeConnection";
import { CORE_BRIDGE_ADDRESS, WHTokenBalance } from "../app";
import {
  standardSetup,
  readAnchorConfig,
  getPortNumber,
  makeDefaultConfig,
  ANCHOR_CONFIG_PATH,
} from "./utils/before";
import {
  keccak256,
  secp256k1,
  serialize,
  toUniversal,
  deserialize,
  UniversalAddress,
} from "@wormhole-foundation/sdk-definitions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import {
  SolanaWormholeCore,
  utils as coreUtils,
  derivePostedVaaKey,
} from "@wormhole-foundation/sdk-solana-core";
import { SolanaSendSigner } from "@wormhole-foundation/sdk-solana";
import { signAndSendWait } from "@wormhole-foundation/sdk-connect";
import { Chain, contracts } from "@wormhole-foundation/sdk-base";

// Define the port number for the test
const portNumber = getPortNumber(path.basename(__filename));

// Constants
export const CORE_BRIDGE_PID = new PublicKey(
  contracts.coreBridge.get("Mainnet", "Solana")!,
);
const GUARDIAN_PRIVATE_KEYS = [
  // Your private keys for mock guardians (hex strings without '0x' prefix)
  "e2f2f8f16b6f8f1f7c6f6e5f4d4c3b2a1a0f0e0d0c0b0a090807060504030201",
  // Add more keys as needed
];
const GUARDIAN_KEY = Buffer.from(GUARDIAN_PRIVATE_KEYS[0], "hex");

describe("receive_message", () => {
  let stakeConnection: StakeConnection;
  let controller;
  let payer: Keypair;
  let airlockPDA: PublicKey;
  let airlockBump: number;
  let messageExecutor: PublicKey;

  before(async () => {
    // Read the Anchor configuration from the specified path
    const config = readAnchorConfig(ANCHOR_CONFIG_PATH);

    // Generate keypairs for the Wormhole token mint account and its authority
    const whMintAccount = Keypair.generate();
    const whMintAuthority = Keypair.generate();

    // Use standardSetup to initialize the StakeConnection and related setup
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      config,
      whMintAccount,
      whMintAuthority,
      makeDefaultConfig(whMintAccount.publicKey),
      WHTokenBalance.fromString("1000"), // Initial balance for testing
    ));

    // The payer is the wallet associated with the provider
    payer = stakeConnection.provider.wallet.payer as Keypair;

    // Find the PDA and bump for the airlock account
    [airlockPDA, airlockBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("airlock")],
      stakeConnection.program.programId,
    );

    // Determine the message executor public key
    messageExecutor = payer.publicKey;

    // Initialize the airlock account
    await stakeConnection.program.methods
      .initializeSpokeAirlock(messageExecutor)
      .accounts({
        payer: payer.publicKey,
        airlock: airlockPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ skipPreflight: true });
  });

  after(async () => {
    // Abort the controller to clean up after the test
    controller.abort();
  });

  it("should process receive_message correctly", async () => {
    console.log("wormholeProgram:", CORE_BRIDGE_PID.toBase58());

    const guardians = new mocks.MockGuardians(0, GUARDIAN_PRIVATE_KEYS);

    // Prepare the message (payload) for the VAA
    const messagePayload = Buffer.from("Your message data"); // Replace with actual message data

    // Emitter address (32 bytes)
    const emitterAddress = Buffer.alloc(32);
    emitterAddress[31] = 1; // Example value

    // Generate the VAA
    const { publicKey, hash } = await postReceiveMessageVaa(
      stakeConnection.provider.connection,
      payer,
      guardians,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      BigInt(1),
      messagePayload,
      { sourceChain: "Ethereum" },
    );

    console.log("payer.publicKey:", payer.publicKey.toBase58());
    console.log("airlockPDA:", airlockPDA.toBase58());
    console.log("postedVaaAddress:", publicKey.toBase58());
    console.log("wormholeProgram:", CORE_BRIDGE_PID.toBase58());
    console.log("systemProgram:", SystemProgram.programId.toBase58());

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("message_received"), hash],
      stakeConnection.program.programId,
    );

    // Invoke receive_message instruction
    await stakeConnection.program.methods
      .receiveMessage(hash)
      .accounts({
        payer: payer.publicKey,
        messageReceived: messageReceivedPDA,
        airlock: airlockPDA,
        postedVaa: publicKey,
        wormholeProgram: CORE_BRIDGE_PID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ skipPreflight: true });

    // Verify the message_received account
    const messageReceivedAccount =
      await stakeConnection.program.account.messageReceived.fetch(
        messageReceivedPDA,
      );

    assert.equal(messageReceivedAccount.executed, true);
  });
});

export async function postReceiveMessageVaa(
  connection: Connection,
  payer: Keypair,
  guardians: mocks.MockGuardians,
  foreignEmitterAddress: Array<number>,
  sequence: bigint,
  message: Buffer,
  args: { sourceChain?: Chain; timestamp?: number } = {},
) {
  let { sourceChain, timestamp } = args;
  sourceChain = sourceChain ?? "Ethereum";
  timestamp = timestamp ?? (await getBlockTime(connection));

  const foreignEmitter = new mocks.MockEmitter(
    toUniversal(sourceChain, new Uint8Array(foreignEmitterAddress)),
    sourceChain,
    sequence - BigInt(1),
  );

  const published = foreignEmitter.publishMessage(
    0, // nonce
    message,
    0, // consistencyLevel
    timestamp,
  );
  const vaa = guardians.addSignatures(published, [0]);

  await postVaa(
    connection,
    payer,
    Buffer.from(serialize(vaa)),
    CORE_BRIDGE_PID,
  );

  let hash = vaa.hash;
  let publicKey = coreUtils.derivePostedVaaKey(
    CORE_BRIDGE_PID,
    Buffer.from(hash),
  );
  return { publicKey, hash };
}

/**
 * Helper function to post VAA on Solana.
 * This function uses the Wormhole SDK to post the VAA to the Solana Core Bridge.
 */
async function postVaa(
  connection: Connection,
  payer: Keypair,
  vaaBuf: Buffer,
  coreBridgeAddress?: PublicKey,
) {
  const core = new SolanaWormholeCore("Devnet", "Solana", connection, {
    coreBridge: (coreBridgeAddress ?? CORE_BRIDGE_PID).toString(),
  });
  console.log("payer.publicKey:", payer.publicKey.toBase58());
  const txs = core.postVaa(payer.publicKey, deserialize("Uint8Array", vaaBuf));
  const signer = new SolanaSendSigner(connection, "Solana", payer, false, {});
  await signAndSendWait(txs, signer);
}

/**
 * Utility function to get block time.
 * You should implement this function according to your project's utilities.
 */
async function getBlockTime(connection: Connection): Promise<number> {
  const slot = await connection.getSlot();
  const blockTime = await connection.getBlockTime(slot);
  if (blockTime === null) {
    throw new Error("Failed to get block time");
  }
  return blockTime;
}
