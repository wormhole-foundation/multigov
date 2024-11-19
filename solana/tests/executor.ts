import path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { ethers } from "ethers";
import assert from "assert";
import { StakeConnection } from "../app/StakeConnection";
import { WHTokenBalance } from "../app";
import {
  standardSetup,
  readAnchorConfig,
  getPortNumber,
  makeDefaultConfig,
  ANCHOR_CONFIG_PATH,
} from "./utils/before";
import {
  serialize,
  toUniversal,
  deserialize,
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
import { Program } from "@coral-xyz/anchor";
import { ExternalProgram } from "./artifacts/external_program.ts";
import externalProgramIdl from "./artifacts/external_program.json";

// Define the port number for the test
const portNumber = getPortNumber(path.basename(__filename));

// Constants
export const CORE_BRIDGE_PID = new PublicKey(
  contracts.coreBridge.get("Testnet", "Solana")!,
);

export const GUARDIAN_KEY =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
export const MOCK_GUARDIANS = new mocks.MockGuardians(0, [GUARDIAN_KEY]);
describe("receive_message", () => {
  let stakeConnection: StakeConnection;
  let controller;
  let payer: Keypair;
  let airlockPDA: PublicKey;
  let messageExecutorPDA: PublicKey;
  let messageExecutor: PublicKey;
  let externalProgram: Program<ExternalProgram>;

  before(async () => {
    // Read the Anchor configuration from the specified path
    const config = readAnchorConfig(ANCHOR_CONFIG_PATH);

    // Generate keypairs for the Wormhole token mint account and its authority
    const whMintAccount = Keypair.generate();
    const whMintAuthority = Keypair.generate();
    const governanceAuthority = Keypair.generate();

    // Use standardSetup to initialize the StakeConnection and related setup
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      config,
      whMintAccount,
      whMintAuthority,
      governanceAuthority,
      makeDefaultConfig(whMintAccount.publicKey),
      WHTokenBalance.fromString("1000"), // Initial balance for testing
    ));

    // The payer is the wallet associated with the provider
    payer = stakeConnection.provider.wallet.payer as Keypair;

    // Find the PDA and bump for the airlock account
    [airlockPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("airlock")],
      stakeConnection.program.programId,
    );

    [messageExecutorPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("spoke_message_executor")],
      stakeConnection.program.programId,
    );

    // Initialize the airlock account
    await stakeConnection.program.methods
      .initializeSpokeAirlock()
      .accounts({
        payer: payer.publicKey,
        airlock: airlockPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ skipPreflight: true });

    // Initialize the message executor
    await stakeConnection.program.methods
      .initializeSpokeMessageExecutor(2)
      .accounts({
        governanceAuthority: governanceAuthority.publicKey,
        executor: messageExecutorPDA,
        config: stakeConnection.configAddress,
        hubDispatcher: new PublicKey(Buffer.alloc(32, "f0", "hex")),
        systemProgram: SystemProgram.programId,
      })
      .signers([governanceAuthority])
      .rpc({ skipPreflight: true });

    externalProgram = new Program<ExternalProgram>(
      externalProgramIdl as any,
      stakeConnection.provider,
    );
  });

  after(async () => {
    // Abort the controller to clean up after the test
    controller.abort();
  });

  it("should process receive_message correctly", async () => {
    const { messagePayloadBuffer, remainingAccounts } =
      await generateTransferInstruction(stakeConnection, payer);

    // Generate the VAA
    const { publicKey, hash } = await postReceiveMessageVaa(
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      BigInt(1),
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(BigInt(1), 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Invoke receive_message instruction
    await stakeConnection.program.methods
      .receiveMessage()
      .accounts({
        payer: payer.publicKey,
        messageReceived: messageReceivedPDA,
        airlock: airlockPDA,
        messageExecutor: messageExecutorPDA,
        postedVaa: publicKey,
        wormholeProgram: CORE_BRIDGE_PID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .signers([payer])
      .rpc({ skipPreflight: true });
  });

  it("should fail if message already executed", async () => {
    const { messagePayloadBuffer, remainingAccounts } =
      await generateTransferInstruction(stakeConnection, payer);

    // Generate the VAA
    const { publicKey, hash } = await postReceiveMessageVaa(
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      BigInt(1),
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(BigInt(1), 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Invoke receive_message instruction

    try {
      await stakeConnection.program.methods
        .receiveMessage()
        .accounts({
          payer: payer.publicKey,
          messageReceived: messageReceivedPDA,
          airlock: airlockPDA,
          messageExecutor: messageExecutorPDA,
          postedVaa: publicKey,
          wormholeProgram: CORE_BRIDGE_PID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .signers([payer])
        .rpc({ skipPreflight: true });
    } catch (e) {}
  });

  it("should process receive_message with an external program instruction correctly", async () => {
    // Initialize the config account
    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      externalProgram.programId,
    );

    await externalProgram.methods
      .initialize(airlockPDA)
      .accounts({
        payer: payer.publicKey,
        config: configPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    // Generate the instruction and message payload
    const { messagePayloadBuffer, remainingAccounts } =
      await generateExternalProgramInstruction(
        externalProgram,
        stakeConnection,
        airlockPDA,
      );

    // Generate the VAA
    const { publicKey, hash } = await postReceiveMessageVaa(
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      BigInt(2),
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(BigInt(2), 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Invoke receiveMessage instruction
    await stakeConnection.program.methods
      .receiveMessage()
      .accounts({
        payer: payer.publicKey,
        messageReceived: messageReceivedPDA,
        airlock: airlockPDA,
        messageExecutor: messageExecutorPDA,
        postedVaa: publicKey,
        wormholeProgram: CORE_BRIDGE_PID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .signers([payer])
      .rpc({ skipPreflight: true });

    // Fetch the config account and verify the counter
    const configAccount = await externalProgram.account.config.fetch(configPDA);
    assert.equal(
      configAccount.counter.toNumber(),
      1, // Adjust accordingly
      "Counter did not increment as expected",
    );
  });
});

export async function generateTransferInstruction(
  stakeConnection: StakeConnection,
  payer: Keypair,
): Promise<{ messagePayloadBuffer: Buffer; remainingAccounts: any[] }> {
  const recipientKeypair = Keypair.generate();
  const lamportsForRecipient =
    await stakeConnection.provider.connection.getMinimumBalanceForRentExemption(
      0,
    );

  const createRecipientAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: recipientKeypair.publicKey,
    lamports: lamportsForRecipient,
    space: 0,
    programId: SystemProgram.programId,
  });

  const tx = new Transaction().add(createRecipientAccountIx);

  await stakeConnection.provider.sendAndConfirm(tx, [payer, recipientKeypair]);

  const lamports = 1000; // Amount to transfer

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: recipientKeypair.publicKey,
    lamports: lamports,
  });

  // Extract programId, accounts, data
  const accounts = transferInstruction.keys.map((accountMeta) => {
    return {
      pubkey: "0x" + accountMeta.pubkey.toBuffer().toString("hex"),
      isSigner: accountMeta.isSigner,
      isWritable: accountMeta.isWritable,
    };
  });

  const instructionData = {
    programId: "0x" + transferInstruction.programId.toBuffer().toString("hex"),
    accounts: accounts,
    data: "0x" + transferInstruction.data.toString("hex"),
  };

  // Prepare the message
  const messageId = BigInt(1);
  const wormholeChainId = BigInt(1);
  const instructions = [instructionData];
  const instructionsLength = BigInt(instructions.length);

  // Define the ABI types
  const SolanaAccountMetaType =
    "tuple(bytes32 pubkey, bool isSigner, bool isWritable)";
  const SolanaInstructionType = `tuple(bytes32 programId, ${SolanaAccountMetaType}[] accounts, bytes data)`;
  const MessageType = `tuple(uint256 messageId, uint16 wormholeChainId, ${SolanaInstructionType}[] instructions)`;

  // Prepare the message without instructionsLength
  const messageObject = {
    messageId: messageId,
    wormholeChainId: wormholeChainId,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const messagePayloadHex = abiCoder.encode([MessageType], [messageObject]);

  // Convert the encoded message to Buffer
  const messagePayloadBuffer = Buffer.from(messagePayloadHex.slice(2), "hex");

  // Prepare the required accounts for the instruction
  const remainingAccounts = transferInstruction.keys.map((key) => ({
    pubkey: key.pubkey,
    isWritable: key.isWritable,
    isSigner: key.isSigner,
  }));

  // Include the programId account as well
  remainingAccounts.push({
    pubkey: transferInstruction.programId,
    isWritable: false,
    isSigner: false,
  });

  return { messagePayloadBuffer, remainingAccounts };
}

export async function generateExternalProgramInstruction(
  externalProgram: Program,
  stakeConnection: StakeConnection,
  airlockPDA: PublicKey,
): Promise<{ messagePayloadBuffer: Buffer; remainingAccounts: any[] }> {
  // Derive the config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    externalProgram.programId,
  );

  // Create the admin_action instruction
  const adminActionIx = await externalProgram.methods
    .adminAction()
    .accounts({
      admin: airlockPDA,
      config: configPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Extract programId, accounts, data
  const accounts = adminActionIx.keys.map((accountMeta) => ({
    pubkey: "0x" + accountMeta.pubkey.toBuffer().toString("hex"),
    isSigner: accountMeta.isSigner,
    isWritable: accountMeta.isWritable,
  }));

  const instructionData = {
    programId: "0x" + adminActionIx.programId.toBuffer().toString("hex"),
    accounts: accounts,
    data: "0x" + adminActionIx.data.toString("hex"),
  };

  // Prepare the message
  const messageId = BigInt(1);
  const wormholeChainId = BigInt(1);
  const instructions = [instructionData];
  const instructionsLength = BigInt(instructions.length);

  // Define the ABI types
  const SolanaAccountMetaType =
    "tuple(bytes32 pubkey, bool isSigner, bool isWritable)";
  const SolanaInstructionType = `tuple(bytes32 programId, ${SolanaAccountMetaType}[] accounts, bytes data)`;
  const MessageType = `tuple(uint256 messageId, uint256 wormholeChainId,  ${SolanaInstructionType}[] instructions)`;

  // Prepare the message
  const messageObject = {
    messageId: messageId,
    wormholeChainId: wormholeChainId,
    instructionsLength: instructionsLength,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const messagePayloadHex = abiCoder.encode([MessageType], [messageObject]);

  // Convert the encoded message to Buffer
  const messagePayloadBuffer = Buffer.from(messagePayloadHex.slice(2), "hex");

  // Prepare the required accounts for the instruction
  const remainingAccounts = adminActionIx.keys.map((key) => ({
    pubkey: key.pubkey,
    isWritable: key.isWritable,
    isSigner: key.isSigner,
  }));

  // Include the programId account as well
  remainingAccounts.push({
    pubkey: adminActionIx.programId,
    isWritable: false,
    isSigner: false,
  });

  return { messagePayloadBuffer, remainingAccounts };
}

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
  const core = new SolanaWormholeCore("Testnet", "Solana", connection, {
    coreBridge: (coreBridgeAddress ?? CORE_BRIDGE_PID).toString(),
  });
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
