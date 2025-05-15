import { AnchorError, Program, utils } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Chain, Network, toChainId } from "@wormhole-foundation/sdk-base";
import { signAndSendWait } from "@wormhole-foundation/sdk-connect";
import {
  deserialize,
  serialize,
  serializePayload,
  toUniversal,
  VAA,
} from "@wormhole-foundation/sdk-definitions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import {
  SolanaAddress,
  SolanaChains,
  SolanaSendSigner,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from "@wormhole-foundation/sdk-solana";
import {
  utils as coreUtils,
  SolanaWormholeCore,
} from "@wormhole-foundation/sdk-solana-core";
import * as wasm from "@wormhole/staking-wasm";
import assert from "assert";
import BN from "bn.js";
import { ethers } from "ethers";
import * as fs from "fs";
import path from "path";
import { WHTokenBalance } from "../app";
import { StakeConnection } from "../app/StakeConnection";
import {
  readWindowLengths,
  WindowLengthsAccount,
} from "../app/vote_weight_window_lengths";
import externalProgramIdl from "./artifacts/external_program.json";
import { ExternalProgram } from "./artifacts/external_program";
import {
  ANCHOR_CONFIG_PATH,
  getPortNumber,
  makeDefaultConfig,
  readAnchorConfig,
  standardSetup,
} from "./utils/before";
import {
  BpfLoaderUpgradeable,
  BpfLoaderUpgradeableProgram,
} from "./utils/bpf-upgradeable-program";
import { CORE_BRIDGE_PID } from "./utils/constants";

// Define the port number for the test
const portNumber = getPortNumber(path.basename(__filename));

export const GUARDIAN_KEY =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
export const MOCK_GUARDIANS = new mocks.MockGuardians(0, [GUARDIAN_KEY]);

// Define the ABI types
const SolanaAccountMetaType =
  "tuple(bytes32 pubkey, bool isSigner, bool isWritable)";
const SolanaInstructionType = `tuple(bytes32 programId, ${SolanaAccountMetaType}[] accounts, bytes data)`;
const MessageType = [
  "uint256 messageId",
  "uint16 wormholeChainId",
  `${SolanaInstructionType}[] instructions`,
];

describe("receive_message", () => {
  let stakeConnection: StakeConnection;
  let controller;
  let payer: Keypair;
  let airlockPDA: PublicKey;
  let messageExecutorPDA: PublicKey;
  let externalProgram: Program<ExternalProgram>;
  let sequence = BigInt(1);

  async function confirm(signature: string): Promise<string> {
    const block =
      await stakeConnection.provider.connection.getLatestBlockhash();
    await stakeConnection.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  }

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
      })
      .signers([payer])
      .rpc({ skipPreflight: true });

    // Initialize the message executor
    await stakeConnection.program.methods
      .initializeSpokeMessageExecutor(2)
      .accounts({
        governanceAuthority: governanceAuthority.publicKey,
        hubDispatcher: new PublicKey(Buffer.alloc(32, "f0", "hex")),
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

  it("should fail if invalid wormhole chain id", async () => {
    const { messagePayloadBuffer, remainingAccounts } =
      await generateTransferInstruction(stakeConnection, payer, BigInt(2));

    // Generate the VAA
    const { publicKey } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      sequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(sequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    try {
      await stakeConnection.program.methods
        .receiveMessage(new BN(100000000))
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
        .rpc()
        .then(confirm);

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidWormholeChainId",
      );
    }
  });

  it("should process receive_message correctly", async () => {
    const { messagePayloadBuffer, remainingAccounts } =
      await generateTransferInstruction(stakeConnection, payer);

    // Generate the VAA
    const { publicKey } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      sequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(sequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Invoke receive_message instruction
    await stakeConnection.program.methods
      .receiveMessage(new BN(100000000))
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

    // Update sequence
    ++sequence;
  });

  it("should fail if message already executed", async () => {
    const oldSequence = sequence - BigInt(1);
    const { messagePayloadBuffer, remainingAccounts } =
      await generateTransferInstruction(stakeConnection, payer);

    // Generate the VAA
    const { publicKey, hash } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      oldSequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(oldSequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Invoke receive_message instruction

    try {
      await stakeConnection.program.methods
        .receiveMessage(new BN(100000000))
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
      [Buffer.from("configV2")],
      externalProgram.programId,
    );

    await externalProgram.methods
      .initialize(airlockPDA, airlockPDA)
      .accounts({
        payer: payer.publicKey,
      })
      .signers([payer])
      .rpc();

    // Generate the instruction and message payload
    const { messagePayloadBuffer, remainingAccounts } =
      await generateExternalProgramInstruction(externalProgram, airlockPDA);

    // Generate the VAA
    const { publicKey } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      sequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(sequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Invoke receiveMessage instruction
    await stakeConnection.program.methods
      .receiveMessage(new BN(100000000))
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

    // Update sequence
    ++sequence;
  });

  it("should self-upgrade using airlockPDA correctly", async () => {
    // Generate the instruction and message payload
    const { messagePayloadBuffer, remainingAccounts } =
      await generateUpgradeProgramInstruction(
        stakeConnection.provider.connection,
        stakeConnection,
        payer,
        airlockPDA,
      );

    // Generate the VAA
    const { publicKey } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      sequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
      externalProgram,
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(sequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    // Set airlock PDA to be passed as non-signer
    const remainingAccountsModified = remainingAccounts.map((a) => {
      if (a.pubkey.toBase58() === airlockPDA.toBase58()) {
        return {
          pubkey: a.pubkey,
          isWritable: a.isWritable,
          isSigner: false,
        };
      } else return a;
    });

    // Invoke receiveMessage instruction
    await stakeConnection.program.methods
      .receiveMessage(new BN(100000000))
      .accounts({
        payer: payer.publicKey,
        messageReceived: messageReceivedPDA,
        airlock: airlockPDA,
        messageExecutor: messageExecutorPDA,
        postedVaa: publicKey,
        wormholeProgram: CORE_BRIDGE_PID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccountsModified)
      .signers([payer])
      .rpc({ skipPreflight: true });

    // Update sequence
    ++sequence;
  });

  it("should fail to update VoteWeightWindowLengths if the maximum allowable voice weight window length is exceeded", async () => {
    const windowLength = 851;
    // Generate the instruction and message payload
    const { messagePayloadBuffer, remainingAccounts } =
      await generateUpdateVoteWeightWindowLengthsInstruction(
        stakeConnection,
        airlockPDA,
        new BN(windowLength),
      );

    // Generate the VAA
    const { publicKey } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      sequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(sequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    const remainingAccountsModified = remainingAccounts.map((a) => {
      if (a.pubkey.toBase58() === airlockPDA.toBase58()) {
        return {
          pubkey: a.pubkey,
          isWritable: a.isWritable,
          isSigner: false,
        };
      } else return a;
    });

    try {
      // Invoke receiveMessage instruction
      await stakeConnection.program.methods
        .receiveMessage(new BN(100000000))
        .accounts({
          payer: payer.publicKey,
          messageReceived: messageReceivedPDA,
          airlock: airlockPDA,
          messageExecutor: messageExecutorPDA,
          postedVaa: publicKey,
          wormholeProgram: CORE_BRIDGE_PID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccountsModified)
        .rpc();

      assert.fail("Expected error was not thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "ExceedsMaxAllowableVoteWeightWindowLength",
      );
    }
  });

  it("should successfully update VoteWeightWindowLengths", async () => {
    const windowLength = 850;
    // Generate the instruction and message payload
    const { messagePayloadBuffer, remainingAccounts } =
      await generateUpdateVoteWeightWindowLengthsInstruction(
        stakeConnection,
        airlockPDA,
        new BN(windowLength),
      );

    // Generate the VAA
    const { publicKey } = await postReceiveMessageVaa(
      stakeConnection,
      stakeConnection.provider.connection,
      payer,
      MOCK_GUARDIANS,
      Array.from(Buffer.alloc(32, "f0", "hex")),
      sequence,
      messagePayloadBuffer,
      { sourceChain: "Ethereum" },
    );

    // Prepare the seeds
    const messageReceivedSeed = Buffer.from("message_received");
    const emitterChainSeed = Buffer.alloc(2);
    emitterChainSeed.writeUInt16BE(2, 0);
    const emitterAddressSeed = Buffer.alloc(32, "f0", "hex");
    const sequenceSeed = Buffer.alloc(8);
    sequenceSeed.writeBigUInt64BE(sequence, 0);

    // Prepare PDA for message_received
    const [messageReceivedPDA] = PublicKey.findProgramAddressSync(
      [messageReceivedSeed, emitterChainSeed, emitterAddressSeed, sequenceSeed],
      stakeConnection.program.programId,
    );

    const remainingAccountsModified = remainingAccounts.map((a) => {
      if (a.pubkey.toBase58() === airlockPDA.toBase58()) {
        return {
          pubkey: a.pubkey,
          isWritable: a.isWritable,
          isSigner: false,
        };
      } else return a;
    });

    // Invoke receiveMessage instruction
    await stakeConnection.program.methods
      .receiveMessage(new BN(100000000))
      .accounts({
        payer: payer.publicKey,
        messageReceived: messageReceivedPDA,
        airlock: airlockPDA,
        messageExecutor: messageExecutorPDA,
        postedVaa: publicKey,
        wormholeProgram: CORE_BRIDGE_PID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccountsModified)
      .rpc({ skipPreflight: true });

    const [voteWeightWindowLengthsAccountAddress, _] =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(
            wasm.Constants.VOTE_WEIGHT_WINDOW_LENGTHS_SEED(),
          ),
        ],
        stakeConnection.program.programId,
      );

    const windowLengths: WindowLengthsAccount = await readWindowLengths(
      stakeConnection.program.provider.connection,
      voteWeightWindowLengthsAccountAddress,
    );
    assert.equal(windowLengths.getWindowLengthCount(), 2);
    assert.equal(windowLengths.voteWeightWindowLengths.nextIndex, 2);
    assert.equal(
      windowLengths.getLastWindowLength().value.toString(),
      windowLength.toString(),
    );

    // Update sequence
    ++sequence;
  });
});

export async function generateTransferInstruction(
  stakeConnection: StakeConnection,
  payer: Keypair,
  wormholeChainId: bigint = BigInt(1),
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
  const instructions = [instructionData];

  // Prepare the message without instructionsLength
  const messageObject = {
    messageId: messageId,
    wormholeChainId: wormholeChainId,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const messagePayloadHex = abiCoder.encode(
    MessageType,
    Object.values(messageObject),
  );

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
  externalProgram: Program<ExternalProgram>,
  airlockPDA: PublicKey,
): Promise<{ messagePayloadBuffer: Buffer; remainingAccounts: any[] }> {
  // Create the admin_action instruction
  const adminActionIx = await externalProgram.methods
    .adminAction()
    .accounts({
      admin: airlockPDA,
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

  // Prepare the message
  const messageObject = {
    messageId: messageId,
    wormholeChainId: wormholeChainId,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const messagePayloadHex = abiCoder.encode(
    MessageType,
    Object.values(messageObject),
  );

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

export async function generateUpgradeProgramInstruction(
  connection: Connection,
  stakeConnection: StakeConnection,
  payer: Keypair,
  airlockPDA: PublicKey,
): Promise<{ messagePayloadBuffer: Buffer; remainingAccounts: any[] }> {
  // Set program upgrade authority to airlock PDA
  await BpfLoaderUpgradeable.setProgramAuthority(
    connection,
    payer,
    stakeConnection.program.programId,
    payer,
    airlockPDA,
  );

  // Deploy program data to buffer
  const bufferAccount = Keypair.generate();
  const bufferAuthorityAccount = Keypair.generate();
  const programData = await fs.readFileSync(
    path.join(__dirname, "../target/deploy/staking.so"),
  );
  const bufferAccountSize = BpfLoaderUpgradeable.getBufferAccountSize(
    programData.length,
  );
  const bufferAccountBalance =
    await connection.getMinimumBalanceForRentExemption(bufferAccountSize);
  await BpfLoaderUpgradeable.createBuffer(
    connection,
    payer,
    bufferAccount,
    bufferAuthorityAccount.publicKey,
    bufferAccountBalance,
    programData.length,
  );
  await BpfLoaderUpgradeable.loadBuffer(
    connection,
    payer,
    bufferAccount.publicKey,
    bufferAuthorityAccount,
    programData,
  );
  await BpfLoaderUpgradeable.setBufferAuthority(
    connection,
    payer,
    bufferAccount.publicKey,
    bufferAuthorityAccount,
    airlockPDA,
  );

  // Create upgradeIx
  const upgradeIx = await BpfLoaderUpgradeableProgram.upgrade({
    programPubkey: stakeConnection.program.programId,
    bufferPubkey: bufferAccount.publicKey,
    spillPubkey: airlockPDA,
    authorityPubkey: airlockPDA,
  });

  // Extract programId, accounts, data
  const accounts = upgradeIx.keys.map((accountMeta) => ({
    pubkey: "0x" + accountMeta.pubkey.toBuffer().toString("hex"),
    isSigner: accountMeta.isSigner,
    isWritable: accountMeta.isWritable,
  }));

  const instructionData = {
    programId: "0x" + upgradeIx.programId.toBuffer().toString("hex"),
    accounts: accounts,
    data: "0x" + upgradeIx.data.toString("hex"),
  };

  // Prepare the message
  const messageId = BigInt(1);
  const wormholeChainId = BigInt(1);
  const instructions = [instructionData];

  // Prepare the message
  const messageObject = {
    messageId: messageId,
    wormholeChainId: wormholeChainId,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const messagePayloadHex = abiCoder.encode(
    MessageType,
    Object.values(messageObject),
  );

  // Convert the encoded message to Buffer
  const messagePayloadBuffer = Buffer.from(messagePayloadHex.slice(2), "hex");

  // Prepare the required accounts for the instruction
  const remainingAccounts = upgradeIx.keys.map((key) => ({
    pubkey: key.pubkey,
    isWritable: key.isWritable,
    isSigner: key.isSigner,
  }));

  // Include the programId account as well
  remainingAccounts.push({
    pubkey: upgradeIx.programId,
    isWritable: false,
    isSigner: false,
  });

  return { messagePayloadBuffer, remainingAccounts };
}

export async function generateUpdateVoteWeightWindowLengthsInstruction(
  stakeConnection: StakeConnection,
  airlockPDA: PublicKey,
  windowLength: BN,
): Promise<{ messagePayloadBuffer: Buffer; remainingAccounts: any[] }> {
  const [voteWeightWindowLengthsAccountAddress, _] =
    PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(
          wasm.Constants.VOTE_WEIGHT_WINDOW_LENGTHS_SEED(),
        ),
      ],
      stakeConnection.program.programId,
    );

  // Create the admin_action instruction
  const updateVoteWeightWindowLengthsIx = await stakeConnection.program.methods
    .updateVoteWeightWindowLengths(windowLength)
    .accounts({
      payer: stakeConnection.userPublicKey(),
      airlock: airlockPDA,
      voteWeightWindowLengths: voteWeightWindowLengthsAccountAddress,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Extract programId, accounts, data
  const accounts = updateVoteWeightWindowLengthsIx.keys.map((accountMeta) => ({
    pubkey: "0x" + accountMeta.pubkey.toBuffer().toString("hex"),
    isSigner: accountMeta.isSigner,
    isWritable: accountMeta.isWritable,
  }));

  const instructionData = {
    programId:
      "0x" +
      updateVoteWeightWindowLengthsIx.programId.toBuffer().toString("hex"),
    accounts: accounts,
    data: "0x" + updateVoteWeightWindowLengthsIx.data.toString("hex"),
  };

  // Prepare the message
  const messageId = BigInt(1);
  const wormholeChainId = BigInt(1);
  const instructions = [instructionData];

  // Prepare the message
  const messageObject = {
    messageId: messageId,
    wormholeChainId: wormholeChainId,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const messagePayloadHex = abiCoder.encode(
    MessageType,
    Object.values(messageObject),
  );

  // Convert the encoded message to Buffer
  const messagePayloadBuffer = Buffer.from(messagePayloadHex.slice(2), "hex");

  // Prepare the required accounts for the instruction
  const remainingAccounts = updateVoteWeightWindowLengthsIx.keys.map((key) => ({
    pubkey: key.pubkey,
    isWritable: key.isWritable,
    isSigner: key.isSigner,
  }));

  // Include the programId account as well
  remainingAccounts.push({
    pubkey: updateVoteWeightWindowLengthsIx.programId,
    isWritable: false,
    isSigner: false,
  });

  return { messagePayloadBuffer, remainingAccounts };
}

export async function postReceiveMessageVaa(
  stakeConnection: StakeConnection,
  connection: Connection,
  payer: Keypair,
  guardians: mocks.MockGuardians,
  foreignEmitterAddress: Array<number>,
  sequence: bigint,
  message: Buffer,
  args: { sourceChain?: Chain; timestamp?: number } = {},
  externalProgram: Program<ExternalProgram> = undefined,
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
    stakeConnection,
    connection,
    payer,
    Buffer.from(serialize(vaa)),
    CORE_BRIDGE_PID,
    externalProgram,
  );

  const hash = vaa.hash;
  const publicKey = coreUtils.derivePostedVaaKey(
    CORE_BRIDGE_PID,
    Buffer.from(hash),
  );
  return { publicKey, hash };
}

/**
 * Helper function to post VAA on Solana.
 * If `externalProgram` is passed, then this function will use it to populate a buffer
 * with VAA data and post the VAA to the Solana Core Bridge via a CPI call.
 * Otherwise, this uses the Wormhole SDK to post the VAA to the Solana Core Bridge directly.
 */
async function postVaa(
  stakeConnection: StakeConnection,
  connection: Connection,
  payer: Keypair,
  vaaBuf: Buffer,
  coreBridgeAddress?: PublicKey,
  externalProgram: Program<ExternalProgram> = undefined,
) {
  const coreBridge = (coreBridgeAddress ?? CORE_BRIDGE_PID).toString();
  const core = new SolanaWormholeCore("Testnet", "Solana", connection, {
    coreBridge,
  });
  const signer = new SolanaSendSigner(connection, "Solana", payer, false, {});
  const vaa = deserialize("Uint8Array", vaaBuf);

  if (externalProgram) {
    // Verify signatures
    const signatureSet = Keypair.generate();
    const txs = verifySignatures(core, payer.publicKey, vaa, signatureSet);
    const signer = new SolanaSendSigner(connection, "Solana", payer, false, {});
    await signAndSendWait(txs, signer);

    // Populate buffer with VAA data in chunks
    const CHUNK_SIZE = 914; // This may need to be decreased if no LUT is configured
    const vaaPayload = Buffer.from(
      serializePayload(vaa.payloadLiteral, vaa.payload),
    );
    await stakeConnection.sendAndConfirmAsVersionedTransaction([
      // Populate VAA with part of payload
      await externalProgram.methods
        .populateBuffer(new BN(vaaPayload.length), {
          version: 1,
          guardianSetIndex: vaa.guardianSet,
          timestamp: vaa.timestamp,
          nonce: vaa.nonce,
          emitterChain: toChainId(vaa.emitterChain),
          emitterAddress: [...vaa.emitterAddress.toUint8Array()],
          sequence: new BN(vaa.sequence.toString()),
          consistencyLevel: vaa.consistencyLevel,
          payload: vaaPayload.subarray(0, CHUNK_SIZE),
        })
        .accounts({
          payer: payer.publicKey,
        })
        .signers([payer])
        .instruction(),
      // Append remaining payload
      await externalProgram.methods
        .appendPayload(vaaPayload.subarray(CHUNK_SIZE))
        .accounts({
          payer: payer.publicKey,
        })
        .signers([payer])
        .instruction(),
    ]);

    // Post VAA via CPI call
    await externalProgram.methods
      .postVaa()
      .accounts({
        admin: payer.publicKey,
        wormholeProgram: coreBridge,
        guardianSet: coreUtils.deriveGuardianSetKey(
          coreBridge,
          vaa.guardianSet,
        ),
        payer: payer.publicKey,
        bridge: coreUtils.deriveWormholeBridgeDataKey(coreBridge),
        signatureSet: signatureSet.publicKey,
        vaa: coreUtils.derivePostedVaaKey(coreBridge, Buffer.from(vaa.hash)),
      })
      .signers([payer])
      .rpc();
  } else {
    // Verify signatures and post VAA
    const txs = core.postVaa(payer.publicKey, vaa);
    await signAndSendWait(txs, signer);
  }
}

async function* verifySignatures<N extends Network, C extends SolanaChains>(
  core: SolanaWormholeCore<N, C>,
  sender: PublicKeyInitData,
  vaa: VAA,
  signatureSet: Keypair,
) {
  const postedVaaAddress = coreUtils.derivePostedVaaKey(
    core.coreBridge.programId,
    Buffer.from(vaa.hash),
  );
  // no need to do anything else, this vaa is posted
  const isPosted = await core.connection.getAccountInfo(postedVaaAddress);
  if (isPosted) return;
  const senderAddr = new SolanaAddress(sender).unwrap();
  const verifySignaturesInstructions =
    await coreUtils.createVerifySignaturesInstructions(
      core.connection,
      core.coreBridge.programId,
      senderAddr,
      vaa,
      signatureSet.publicKey,
    );
  // Create a new transaction for every 2 instructions
  for (let i = 0; i < verifySignaturesInstructions.length; i += 2) {
    const verifySigTx = new Transaction().add(
      ...verifySignaturesInstructions.slice(i, i + 2),
    );
    verifySigTx.feePayer = senderAddr;
    yield createUnsignedTx(
      core,
      { transaction: verifySigTx, signers: [signatureSet] },
      "Core.VerifySignature",
      true,
    );
  }
}

function createUnsignedTx<N extends Network, C extends SolanaChains>(
  core: SolanaWormholeCore<N, C>,
  txReq: SolanaTransaction,
  description: string,
  parallelizable = false,
) {
  return new SolanaUnsignedTransaction(
    txReq,
    core.network,
    core.chain,
    description,
    parallelizable,
  );
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
