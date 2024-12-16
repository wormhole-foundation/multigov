// Usage: npx ts-node app/e2e/05_proposalQueue.ts

import { ethers } from "ethers";
import * as fs from "fs";
import "dotenv/config";
import { signaturesToEvmStruct } from "@wormhole-foundation/wormhole-query-sdk";
import {
  HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS,
  HUB_GOVERNOR_ADDRESS,
  HUB_CHAIN_ID,
} from "../constants";
import input from "@inquirer/input";

const HubGovernorAbiPath = "./app/e2e/abi/HubGovernor.json";
const HubGovernorAbi = JSON.parse(fs.readFileSync(HubGovernorAbiPath, "utf8"));

const HubSolanaMessageDispatcherAbi = [
  "function dispatch(bytes _payload) external payable",
];

const rpcUrl = process.env[`RPC_${HUB_CHAIN_ID}`];
if (!rpcUrl) {
  throw new Error(`RPC endpoint not found for chain ${HUB_CHAIN_ID}`);
}

const ProposalStateNames = [
  "Pending", // 0
  "Active", // 1
  "Canceled", // 2
  "Defeated", // 3
  "Succeeded", // 4
  "Queued", // 5
  "Expired", // 6
  "Executed", // 7
];

async function proposalQueue(): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contract = new ethers.Contract(
      HUB_GOVERNOR_ADDRESS,
      HubGovernorAbi,
      wallet,
    );
    const proposalId = await input({ message: "Enter the proposal id:" });
    let proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
    //     console.log("proposalIdHex:", proposalIdHex);

    const proposalStateNumber = (
      await contract.state.staticCall(proposalId)
    ).toString();
    console.log(
      "Proposal State:",
      ProposalStateNames[parseInt(proposalStateNumber)],
    );
    console.log(
      "proposalVotes(proposalId):",
      await contract.proposalVotes.staticCall(proposalId),
    );

    const fileName = `./app/e2e/log/${proposalId.toString()}.json`;
    if (!fs.existsSync(fileName))
      throw new Error(`Proposal file not found: ${fileName}`);
    const savedProposalData = JSON.parse(fs.readFileSync(fileName, "utf8"));
    console.log("savedProposalData:", savedProposalData);

    // encoding payload with solana calldata
    const iface = new ethers.Interface(HubSolanaMessageDispatcherAbi);
    const calldata = iface.encodeFunctionData("dispatch", [
      savedProposalData.solanaPayloadHex,
    ]);
    const descriptionHash = ethers.keccak256(
      ethers.toUtf8Bytes(savedProposalData.proposalName),
    );
    const executeProposalPayload = [
      [HUB_SOLANA_MESSAGE_DISPATCHER_ADDRESS],
      [0],
      [calldata],
      descriptionHash,
    ];

    console.log("Queueing a proposal...");
    await contract.queue.staticCall(...executeProposalPayload);
    const queue_tx = await contract.queue(...executeProposalPayload);
    console.log(queue_tx);
  } catch (error) {
    console.error(error);
  }
}

proposalQueue();
