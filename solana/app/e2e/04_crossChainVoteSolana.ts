// Usage: npx ts-node app/e2e/04_crossChainVoteSolana.ts

import { ethers } from "ethers";
import * as fs from "fs";
import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import axios from "axios";
import {
  PerChainQueryRequest,
  QueryProxyQueryResponse,
  QueryRequest,
  QueryResponse,
  SolanaPdaQueryRequest,
  SolanaPdaQueryResponse,
  signaturesToEvmStruct,
} from "@wormhole-foundation/wormhole-query-sdk";
import {
  STAKING_ADDRESS,
  HUB_GOVERNOR_ADDRESS,
  HUB_SOLANA_SPOKE_VOTE_DECODER_ADDRESS,
  HUB_VOTE_POOL_ADDRESS,
  HUB_CHAIN_ID,
} from "../constants";
import * as wasm from "@wormhole/staking-wasm";
import input from "@inquirer/input";

const rpcUrl = process.env[`RPC_${HUB_CHAIN_ID}`];
if (!rpcUrl) {
  throw new Error(`RPC endpoint not found for chain ${HUB_CHAIN_ID}`);
}
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const QUERY_URL = "https://testnet.query.wormhole.com/v1/query";
const WORMHOLE_API_KEY = process.env.WORMHOLE_API_KEY;
if (!WORMHOLE_API_KEY) {
  throw new Error("WORMHOLE_API_KEY is required");
}

export interface SolanaPdaEntry {
  programAddress: Uint8Array;
  seeds: Uint8Array[];
}

async function getSolanaQueryResponse(): Promise<{
  bytes: string;
  signatures: any[];
}> {
  const proposalId = await input({ message: "Enter the proposal id:" });
  const proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
  console.log("proposalIdHex:", proposalIdHex);

  const pdas: SolanaPdaEntry[] = [
    {
      programAddress: STAKING_ADDRESS.toBuffer(),
      seeds: [
        Buffer.from(wasm.Constants.PROPOSAL_SEED()),
        Buffer.from(proposalIdHex, "hex"),
      ],
    },
  ];
  const queryRequest = new QueryRequest(42, [
    new PerChainQueryRequest(1, new SolanaPdaQueryRequest("finalized", pdas)),
  ]);
  const serializedQueryRequest = Buffer.from(queryRequest.serialize()).toString(
    "hex",
  );
  //   console.log("serializedQueryRequest: ", serializedQueryRequest);

  const queryResponse = (
    await axios.post<QueryProxyQueryResponse>(
      QUERY_URL,
      { bytes: serializedQueryRequest },
      { headers: { "X-API-Key": WORMHOLE_API_KEY } },
    )
  ).data;
  //   console.log("queryResponse: ", queryResponse);

  //   const queryResponseHex = QueryResponse.from(Buffer.from(queryResponse.bytes, "hex"));

  const bytes = "0x" + queryResponse["bytes"];
  const signatures = queryResponse["signatures"];
  console.log("bytes: ", bytes);
  console.log("signatures: ", signatures);

  return { bytes, signatures };
}

async function decodeSolana(): Promise<void> {
  try {
    const contractHubSolanaSpokeVoteDecoderABIPath =
      "./app/e2e/abi/HubSolanaSpokeVoteDecoder.json";
    const contractHubSolanaSpokeVoteDecoderABI = JSON.parse(
      fs.readFileSync(contractHubSolanaSpokeVoteDecoderABIPath, "utf8"),
    );
    const contract = new ethers.Contract(
      HUB_SOLANA_SPOKE_VOTE_DECODER_ADDRESS,
      contractHubSolanaSpokeVoteDecoderABI,
      wallet,
    );

    const { bytes, signatures } = await getSolanaQueryResponse();
    const guardianSignatures = signaturesToEvmStruct(signatures);
    //     console.log("guardianSignatures: ", guardianSignatures);

    console.log("Parse and Verify QueryResponse...");
    const parsedQueryResponse =
      await contract.parseAndVerifyQueryResponse.staticCall(
        bytes,
        guardianSignatures,
      );
    let parsedPerChainQueryResponse = [...parsedQueryResponse.responses[0]];
    //     console.log("parsedPerChainQueryResponse:", parsedPerChainQueryResponse);

    console.log("Parse Solana PDA QueryResponse...");
    const solanaPdaQueryResponse =
      await contract.parseSolanaPdaQueryResponse.staticCall(
        parsedPerChainQueryResponse,
      );
    //     console.log("solanaPdaQueryResponse:", solanaPdaQueryResponse);

    console.log("Decode...");
    const queryVote = await contract.decode.staticCall(
      parsedPerChainQueryResponse,
      HUB_GOVERNOR_ADDRESS,
    );
    console.log("queryVote:", queryVote);
  } catch (error) {
    console.error(error);
  }
}

// decodeSolana();

async function crossChainVoteSolana(): Promise<void> {
  try {
    const contractHubVotePoolABIPath = "./app/e2e/abi/HubVotePool.json";
    const contractHubVotePoolABI = JSON.parse(
      fs.readFileSync(contractHubVotePoolABIPath, "utf8"),
    );
    const contract = new ethers.Contract(
      HUB_VOTE_POOL_ADDRESS,
      contractHubVotePoolABI,
      wallet,
    );

    const { bytes, signatures } = await getSolanaQueryResponse();
    const guardianSignatures = signaturesToEvmStruct(signatures);

    console.log("Solana Cross Chain Vote...");
    const tx = await contract.crossChainVote(bytes, guardianSignatures);
    console.log(tx);
  } catch (error) {
    console.error(error);
  }
}

crossChainVoteSolana();
