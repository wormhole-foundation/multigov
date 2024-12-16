// Usage: npx ts-node app/e2e/01_createProposeWithSolanaExecution.ts

import { ethers } from "ethers";
import * as fs from "fs";
import "dotenv/config";
import {
  HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS,
  HUB_GOVERNOR_ADDRESS,
  HUB_CHAIN_ID,
} from "../constants";
import { Connection } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { ExternalProgram } from "./external_program/idl/external_program";
import externalProgramIdl from "./external_program/idl/external_program.json";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE,
  AIRLOCK_PDA_ADDRESS,
} from "../deploy/devnet";
import { v4 as uuidv4 } from "uuid";

// Define the ABI types
const SolanaAccountMetaType =
  "tuple(bytes32 pubkey, bool isSigner, bool isWritable)";
const SolanaInstructionType = `tuple(bytes32 programId, ${SolanaAccountMetaType}[] accounts, bytes data)`;
const MessageType = [
  "uint16 wormholeChainId",
  `${SolanaInstructionType}[] instructions`,
];

const HubGovernorAbiPath = "./app/e2e/abi/HubGovernor.json";
const HubGovernorAbi = JSON.parse(fs.readFileSync(HubGovernorAbiPath, "utf8"));
const HubSolanaMessageDispatcherAbi = [
  "function dispatch(bytes _payload) external payable",
];

const rpcUrl = process.env[`RPC_${HUB_CHAIN_ID}`];
if (!rpcUrl) {
  throw new Error(`RPC endpoint not found for chain ${HUB_CHAIN_ID}`);
}

async function generateSolanaPayload() {
  const DEBUG = true;
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
    {},
  );

  const externalProgram = new Program<ExternalProgram>(
    externalProgramIdl as any,
    provider,
  );

  // Create the adminAction instruction
  const adminActionIx = await externalProgram.methods
    .adminAction()
    .accounts({
      admin: AIRLOCK_PDA_ADDRESS,
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
  const wormholeChainId = BigInt(1);
  const instructions = [instructionData];

  // Prepare the message
  const messageObject = {
    wormholeChainId: wormholeChainId,
    instructions: instructions,
  };

  // Encode the message
  const abiCoder = new ethers.AbiCoder();
  const solanaPayloadHex = abiCoder.encode(
    MessageType,
    Object.values(messageObject),
  );
  console.log("solanaPayloadHex: ", solanaPayloadHex);

  return solanaPayloadHex;
}

async function createProposeWithSolanaExecution(): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contract = new ethers.Contract(
      HUB_GOVERNOR_ADDRESS,
      HubGovernorAbi,
      wallet,
    );
    const proposalName = "proposal-" + uuidv4();
    console.log("proposalName:", proposalName);

    // encoding payload with solana calldata
    const iface = new ethers.Interface(HubSolanaMessageDispatcherAbi);
    const solanaPayloadHex = await generateSolanaPayload();
    const calldata = iface.encodeFunctionData("dispatch", [solanaPayloadHex]);

    const proposalPayload = [
      [HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS],
      [0],
      [calldata],
      proposalName,
    ];
//     console.log("proposalPayload:", proposalPayload);
    console.log("Creating a new proposal...");
    const proposalId = await contract.propose.staticCall(...proposalPayload);
    const tx = await contract.propose(...proposalPayload);
//     console.log("tx:", tx);
    const receipt = await tx.wait();
    console.log("receipt.blockNumber:", receipt.blockNumber);

    console.log("proposalId:", proposalId.toString());
    let proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
    console.log("proposalIdHex:", proposalIdHex);

    const proposalData = {
      proposalName,
      solanaPayloadHex,
      receiptBlockNumber: receipt.blockNumber
    };
    const fileName = `./app/e2e/log/${proposalId.toString()}.json`;
    fs.writeFileSync(fileName, JSON.stringify(proposalData, null, 2));
  } catch (error) {
    console.error(error);
  }
}

createProposeWithSolanaExecution();
