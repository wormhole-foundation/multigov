import path from "path";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { StakeConnection } from "../app/StakeConnection";
import { WHTokenBalance } from "../app";
import {AbiCoder, keccak256, sha256} from "ethers";
import assert from "assert";
import {
    standardSetup,
    readAnchorConfig,
    getPortNumber,
    makeDefaultConfig,
    ANCHOR_CONFIG_PATH,
} from "./utils/before";
import * as console from "node:console";
import {BigNumber} from "@ethersproject/bignumber";

// Define interfaces for SolanaAccountMeta and SolanaInstruction
interface SolanaAccountMeta {
    pubkey: Buffer; // 32 bytes representing the public key
    isSigner: boolean;
    isWritable: boolean;
}

interface SolanaInstruction {
    programId: Buffer; // 32 bytes representing the program ID
    accounts: SolanaAccountMeta[];
    data: Buffer; // Instruction data
}

// Define the test suite for receive_message()
describe("receive_message test", () => {
    let stakeConnection: StakeConnection;
    let payer: Keypair;
    let controller;
    let airlockPDA: PublicKey;
    let airlockBump: number;
    let messageExecutor: PublicKey;

    before(async () => {
        // Initialize the connection and accounts

        // Read the Anchor configuration from the specified path
        const config = readAnchorConfig(ANCHOR_CONFIG_PATH);

        // Get a unique port number for the test based on the filename
        const portNumber = getPortNumber(path.basename(__filename));

        console.log(portNumber);

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
        [airlockPDA, airlockBump] = await PublicKey.findProgramAddress(
            [Buffer.from("airlock")],
            stakeConnection.program.programId,
        );

        // Determine the message executor public key
        // For testing, you can use the payer's public key or generate a new keypair
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
            .rpc({skipPreflight: true});
    });

    after(async () => {
        // Abort the controller to clean up after the test
        controller.abort();
    });

    it("should process the message in receive_message", async () => {
        const recipient = Keypair.generate(); // Generate a recipient account

        // Ensure correct instruction data
        const transferInstruction: SolanaInstruction = {
            programId: SystemProgram.programId.toBuffer(),
            accounts: [
                {
                    pubkey: payer.publicKey.toBuffer(),
                    isSigner: true,
                    isWritable: true,
                },
                {
                    pubkey: recipient.publicKey.toBuffer(),
                    isSigner: false,
                    isWritable: true,
                },
            ],
            data: SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: recipient.publicKey,
                lamports: 1000, // Amount to transfer
            }).data, // Ensure this contains the correct instruction data
        };



        // Prepare the message parameters
        const messageId = BigInt(1); // Arbitrary message ID
        const wormholeChainId = 1; // Example chain ID for testing
        const instructions = [transferInstruction]; // Single instruction in the message

        // Encode the message using the encodeMessage function
        const encodedMessage = encodeMessage(messageId, wormholeChainId, instructions);

        // Compute the message hash (keccak256 hash of the encoded message)
        const messageHash = sha256(encodedMessage); // or keccak256 if the program uses it
        const messageHashBytes = Buffer.from(messageHash.slice(2), "hex"); // Remove '0x' prefix

        console.log("Message Hash:", messageHash);
        console.log("Message Hash Bytes Length:", messageHashBytes.length);

        // Find the PDA for message_received account using the correct seeds
        const [messageReceivedPDA] = await PublicKey.findProgramAddress(
            [Buffer.from("message_received"), messageHashBytes],
            stakeConnection.program.programId,
        );

        console.log("Client messageReceivedPDA:", messageReceivedPDA.toBase58());

        const remainingAccounts = [
            {
                pubkey: payer.publicKey,
                isSigner: true,
                isWritable: true,
            },
            {
                pubkey: recipient.publicKey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: SystemProgram.programId,
                isSigner: false,
                isWritable: false,
            },
        ];


        // Invoke the receive_message function on the staking program
        await stakeConnection.program.methods
            .receiveMessage( messageHashBytes, encodedMessage)
            .accounts({
                payer: payer.publicKey, // The payer of the transaction
                messageReceived: messageReceivedPDA, // The message_received account PDA
                airlock: airlockPDA, // The airlock account PDA
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts(remainingAccounts)
            .signers([payer])
            .rpc({skipPreflight: true});

        // Fetch the message_received account to verify it was marked as executed
        const messageReceivedAccount =
            await stakeConnection.program.account.messageReceived.fetch(messageReceivedPDA);

        // Assert that the message has been marked as executed
        assert.equal(messageReceivedAccount.executed, true);
    });
});

// Function to encode the message as expected by the receive_message function

function encodeMessage(
    messageId: bigint,
    wormholeChainId: bigint,
    instructions: SolanaInstruction[],
): Buffer {
    const abi = new AbiCoder();

    // Define types without field names
    const accountMetaType = "tuple(bytes32,bool,bool)";
    const instructionType = `tuple(
        bytes32,
        ${accountMetaType}[],
        bytes
    )`;
    const messageType = `tuple(
        uint256,
        uint256,
        ${instructionType}[]
    )`;

    // Prepare data without field names
    const messageValue = [
        messageId,
        BigInt(wormholeChainId),
        instructions.map(instr => [
            '0x' + instr.programId.toString('hex'),
            instr.accounts.map(acc => [
                '0x' + acc.pubkey.toString('hex'),
                acc.isSigner,
                acc.isWritable,
            ]),
            '0x' + instr.data.toString('hex'),
        ]),
    ];

    // Encode the message
    const encoded = abi.encode([messageType], [messageValue]);

    console.log("Encoded Message:", encoded);
    return Buffer.from(encoded.slice(2), "hex");
}


