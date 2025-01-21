// Usage: npx ts-node app/e2e/02_addProposal.ts

import {
  EthCallData,
  EthCallWithFinalityQueryRequest,
  PerChainQueryRequest,
  QueryRequest,
  QueryResponse,
} from "@wormhole-foundation/wormhole-query-sdk";
import axios, { AxiosError } from "axios";
import { ethers } from "ethers";
import input from "@inquirer/input";
import "dotenv/config";
import {
  HUB_CHAIN_ID,
  HUB_PROPOSAL_METADATA_ADDRESS,
  STAKING_ADDRESS,
  CORE_BRIDGE_ADDRESS,
} from "../constants";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "../deploy/devnet";
import { getWormholeBridgeData } from "../helpers/wormholeBridgeConfig";
import * as fs from "fs";

const WORMHOLE_API_KEY = process.env.WORMHOLE_API_KEY as string;
const rpcUrl = process.env[`RPC_${HUB_CHAIN_ID}`];
if (!rpcUrl) {
  throw new Error(`RPC endpoint not found for chain ${HUB_CHAIN_ID}`);
}

function encodeSignature(signature: string): string {
  return ethers.id(signature).substring(0, 10);
}

function encodeCalldata(signature: string, parameters: string): string {
  return signature + parameters.substring(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds
async function getLatestFinalizedBlock(rpcUrl: string): Promise<number> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await axios.post(rpcUrl, {
        method: "eth_getBlockByNumber",
        params: ["finalized", false],
        id: 1,
        jsonrpc: "2.0",
      });

      return response.data?.result?.number;
    } catch (error) {
      if (
        error instanceof AxiosError &&
        (error.code === "EHOSTUNREACH" ||
          error.code === "ENETUNREACH" ||
          error.code === "ERR_BAD_REQUEST")
      ) {
        attempt++;
        console.log(
          `Attempt ${attempt} failed. Retrying in ${RETRY_DELAY / 1000} seconds...`,
        );
        await sleep(RETRY_DELAY);
      } else {
        console.error("Error during request:", error);
        break;
      }
    }
  }

  throw new Error("Failed to get the latest finalized block.");
}

async function getWormholeQuery(
  chain: number,
  block: number,
  calldata: EthCallData,
) {
  const request = new QueryRequest(
    0, // nonce
    [
      new PerChainQueryRequest(
        chain, // Ethereum Wormhole Chain ID
        new EthCallWithFinalityQueryRequest(block, "finalized", [calldata]),
      ),
    ],
  ).serialize();

  return (
    await axios.post(
      "https://testnet.query.wormhole.com/v1/query",
      { bytes: Buffer.from(request).toString("hex") },
      { headers: { "X-API-Key": WORMHOLE_API_KEY } },
    )
  ).data;
}

async function getProposalMetadata(
  proposalId: string,
): Promise<{ rawResponse: any }> {
  const encodedSignature = encodeSignature("getProposalMetadata(uint256)");
  const encodedParameters = new ethers.AbiCoder().encode(
    ["uint256"],
    [proposalId],
  );

  const calldata: EthCallData = {
    to: HUB_PROPOSAL_METADATA_ADDRESS,
    data: encodeCalldata(encodedSignature, encodedParameters),
  };

  const latestFinalizedBlock = await getLatestFinalizedBlock(rpcUrl);
  console.log(
    "latestFinalizedBlock:",
    parseInt(latestFinalizedBlock.toString(), 16),
  );
  const rawResponse = await getWormholeQuery(
    HUB_CHAIN_ID,
    latestFinalizedBlock,
    calldata,
  );
  console.log("rawResponse: ", rawResponse);
  const queryResponse = QueryResponse.from(
    Buffer.from(rawResponse.bytes, "hex"),
  );
  //   console.log("queryResponse:", queryResponse);
  const solRequest = queryResponse.request.requests[0].query;
  const solResponse = queryResponse.responses[0].response;
  //   console.log("solRequest:", solRequest);
  //   console.log("solResponse:", solResponse);

  return { rawResponse };
}

async function addProposal() {
  try {
    const connection = new Connection(RPC_NODE);

    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {},
    );

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
      STAKING_ADDRESS,
    );

    const proposalId = await input({ message: "Enter the proposal id:" });
    let proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
    //     console.log("proposalIdHex:", proposalIdHex);

    const fileName = `./app/e2e/log/${proposalId.toString()}.json`;
    if (!fs.existsSync(fileName))
      throw new Error(`Proposal file not found: ${fileName}`);
    const savedProposalData = JSON.parse(fs.readFileSync(fileName, "utf8"));
    console.log("savedProposalData:", savedProposalData);

    while (true) {
      const latestFinalizedBlockInt = parseInt(
        (await getLatestFinalizedBlock(rpcUrl)).toString(),
        16,
      );
      console.log("Latest finalized block:", latestFinalizedBlockInt);

      if (latestFinalizedBlockInt >= savedProposalData.receiptBlockNumber) {
        console.log("The proposal block is finalized.");
        break;
      } else {
        await sleep(5000);
      }
    }

    const proposalIdArray = Buffer.from(proposalIdHex, "hex");
    const { proposalAccount } =
      await stakeConnection.fetchProposalAccount(proposalIdArray);
    const proposalAccountData =
      await stakeConnection.program.account.proposalData.fetchNullable(
        proposalAccount,
      );
    console.log("proposalAccountData:", proposalAccountData);

    if (proposalAccountData == null) {
      const { rawResponse } = await getProposalMetadata(proposalId);

      const sepoliaEthProposalResponse = {
        bytes: rawResponse.bytes,
        signatures: rawResponse.signatures,
      };

      const guardianSignaturesPda = await stakeConnection.postSignatures(
        sepoliaEthProposalResponse.signatures,
      );

      const info = await getWormholeBridgeData(connection, CORE_BRIDGE_ADDRESS);
      const guardianSetIndex = info.guardianSetIndex;

      await stakeConnection.addProposal(
        proposalIdArray,
        Buffer.from(sepoliaEthProposalResponse.bytes, "hex"),
        guardianSignaturesPda,
        guardianSetIndex,
      );
    } else {
      console.log("The proposal has already been created on the solana");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

addProposal();
