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
import { WHTokenBalance } from "../app";
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

export const GUARDIAN_KEY =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
export const MOCK_GUARDIANS = new mocks.MockGuardians(0, [GUARDIAN_KEY]);
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

    await stakeConnection.provider.sendAndConfirm(tx, [
      payer,
      recipientKeypair,
    ]);

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
      programId:
        "0x" + transferInstruction.programId.toBuffer().toString("hex"),
      accounts: accounts,
      data: "0x" + transferInstruction.data.toString("hex"),
    };

    // Prepare the message
    const messageId = ethers.BigNumber.from(1);
    const wormholeChainId = ethers.BigNumber.from(1);
    const instructions = [instructionData];
    const instructionsLength = ethers.BigNumber.from(instructions.length);

    // Define the ABI types
    const SolanaAccountMetaType =
      "tuple(bytes32 pubkey, bool isSigner, bool isWritable)";
    const SolanaInstructionType = `tuple(bytes32 programId, ${SolanaAccountMetaType}[] accounts, bytes data)`;
    const MessageType = `tuple(uint256 messageId, uint256 wormholeChainId, ${SolanaInstructionType}[] instructions)`;

    // Prepare the message without instructionsLength
    const messageObject = {
      messageId: messageId,
      wormholeChainId: wormholeChainId,
      instructions: instructions,
    };

    // Encode the message
    const abiCoder = new ethers.utils.AbiCoder();
    const messagePayloadHex = abiCoder.encode([MessageType], [messageObject]);

    console.log("Encoded message payload:", messagePayloadHex);

    // Convert the encoded message to Buffer
    const messagePayloadBuffer = Buffer.from(messagePayloadHex.slice(2), "hex");

    // Emitter address (32 bytes)
    const emitterAddress = Buffer.alloc(32);
    emitterAddress[31] = 1; // Example value

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

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("message_received"), hash],
      stakeConnection.program.programId,
    );

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

    console.log("Before receiveMessage");
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
      .remainingAccounts(remainingAccounts)
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
  const core = new SolanaWormholeCore("Mainnet", "Solana", connection, {
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
