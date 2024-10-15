// Usage: npx ts-node app/deploy/bridge-script.ts

import {
  EthCallData,
  EthCallQueryRequest,
  PerChainQueryRequest,
  QueryRequest,
  signaturesToEvmStruct,
  QueryResponse,
  QueryProxyQueryResponse,
  signaturesToSolanaArray,
} from "@wormhole-foundation/wormhole-query-sdk";
import axios from "axios";
import { ethers } from "ethers";
import select from "@inquirer/select";
import input from "@inquirer/input";
import dotenv from "dotenv";

import { Keypair } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { CORE_BRIDGE_ADDRESS } from "../constants";
import { RPC_NODE } from "./devnet";
import { getWormholeBridgeData } from "../helpers/wormholeBridgeConfig";
import { deriveGuardianSetKey } from "../helpers/guardianSet";

// Load environment variables from .env file
dotenv.config();

const API_KEY = process.env.WORMHOLE_API_KEY as string;

const scripts: {
  [key: string]: (
    chain: number,
    proposalId: string,
    contractAddress: string,
  ) => Promise<string>;
} = {
  proposal: async (chain, proposalId, contractAddress) => {
    const rpc = process.env[`RPC_${chain}`];

    if (!rpc) {
      throw new Error(`RPC endpoint not found for chain ${chain}`);
    }

    const encodedSignature = encodeSignature("getProposalMetadata(uint256)");
    console.log("encodedSignature:",encodedSignature)
    const encodedParameters = new ethers.AbiCoder().encode(
      ["uint256"],
      [proposalId],
    );
    console.log("encodedParameters:",encodedParameters)

    const calldata: EthCallData = {
      to: contractAddress,
      data: encodeCalldata(encodedSignature, encodedParameters),
    };

    const latestBlock = await getLatestBlock(rpc);

    const result = await getWormholeQuery(chain, latestBlock, calldata);
    console.log("Query response: ", result);
    const queryResponse = QueryResponse.from(Buffer.from(result.bytes, "hex"));
    const solRequest = queryResponse.request.requests[0].query;
    const solResponse = queryResponse.responses[0].response;
    console.log("solRequest:", solRequest);
    console.log("solResponse:", solResponse);

    const signaturesKeypair = Keypair.generate();
    const signatureData = signaturesToSolanaArray(result.signatures);

    const ethProposalResponseBytes = Buffer.from(result.bytes, "hex");
    const proposalIdArray = Buffer.from(encodedParameters, "hex");

    const connection = new Connection(RPC_NODE);

    const info = await getWormholeBridgeData(connection, CORE_BRIDGE_ADDRESS);
    let guardianSetIndex = info.guardianSetIndex;

    const guardianSet = deriveGuardianSetKey(
      CORE_BRIDGE_ADDRESS,
      guardianSetIndex,
    );

    console.log(`
In Solana:
1) save signatures in solana account:
  result.signatures: ${result.signatures}

  const signaturesKeypair = Keypair.generate();
  const signatureData = signaturesToSolanaArray(result.signatures);

  program.methods
    .postSignatures(signatureData, signatureData.length)
    .accounts({ guardianSignatures: signaturesKeypair.publicKey })
    .signers([signaturesKeypair])
    .rpc();
2) call addProposal instruction:
  const ethProposalResponseBytes = Buffer.from(result.bytes, "hex");
  const proposalIdArray = Buffer.from(encodedParameters, "hex");
  
  guardianSetIndex: ${guardianSetIndex}
  guardianSet: ${guardianSet}

  const proposalAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), proposalIdArray],
    program.programId,
  )[0];

  program.methods
    .addProposal(
      ethProposalResponseBytes,
      proposalIdArray,
      guardianSetIndex,
    )
    .accountsPartial({
      proposal: proposalAccount,
      guardianSignatures: signaturesKeypair.publicKey,
      guardianSet: guardianSet,
    });
`)

    return `In EVM chains: you can now call addProposal in evm with the following parameters:\n_queryResponseRaw: 0x${result.bytes}\n_signatures: ${JSON.stringify(signaturesToEvmStruct(result.signatures))}`;
  },
  votes: async (chain, proposalId, contractAddress) => {
    const rpc = process.env[`RPC_${chain}`];

    if (!rpc) {
      throw new Error(`RPC endpoint not found for chain ${chain}`);
    }

    const encodedSignature = encodeSignature("proposalVotes(uint256)");
    const encodedParameters = new ethers.AbiCoder().encode(
      ["uint256"],
      [proposalId],
    );

    const calldata: EthCallData = {
      to: contractAddress,
      data: encodeCalldata(encodedSignature, encodedParameters),
    };

    const latestBlock = await getLatestBlock(rpc);

    const result = await getWormholeQuery(chain, latestBlock, calldata);

    return `You can now call crossChainEVMVote with the following parameters:\n_queryResponseRaw: 0x${result.bytes}\n_signatures: ${JSON.stringify(signaturesToEvmStruct(result.signatures))}`;
  },
};

async function main() {
  const bridgeType = await select({
    message: "What would you like to bridge?",
    choices: [
      {
        name: "proposal",
        value: "proposal",
      },
      {
        name: "votes",
        value: "votes",
      },
    ],
  });

  const chain = await select({
    message: "What chain are you bridging from?",
    choices: [
      { value: 10002, name: "sepolia" },
      { value: 2, name: "ethereum mainnet" },
      { value: 4, name: "binance smart chain" },
      { value: 5, name: "polygon" },
      { value: 6, name: "avalanche" },
      { value: 14, name: "celo" },
      { value: 23, name: "arbitrum" },
      { value: 24, name: "optimism" },
      { value: 25, name: "gnosis" },
      { value: 30, name: "base" },
      { value: 34, name: "scroll" },
      { value: 35, name: "mantle" },
      { value: 36, name: "blast" },
      { value: 10003, name: "arbitrum sepolia" },
      { value: 10005, name: "optimism sepolia" },
    ],
  });

  const proposalId = await input({ message: "Enter the proposal id:" });

  const contractAddress = await input({
    message: "Enter the contract address:",
  });

  console.log(await scripts[bridgeType](chain, proposalId, contractAddress));
}

main();

function encodeSignature(signature: string): string {
  return ethers.id(signature).substring(0, 10);
}

function encodeCalldata(signature: string, parameters: string): string {
  return signature + parameters.substring(2);
}

async function getLatestBlock(rpc: string): Promise<number> {
  return (
    await axios.post(rpc, {
      method: "eth_getBlockByNumber",
      params: ["latest", false],
      id: 1,
      jsonrpc: "2.0",
    })
  ).data?.result?.number;
}

async function getWormholeQuery(
  chain: number,
  latestBlock: number,
  calldata: EthCallData,
) {
  const request = new QueryRequest(
    0, // nonce
    [
      new PerChainQueryRequest(
        chain, // Ethereum Wormhole Chain ID
        new EthCallQueryRequest(latestBlock, [calldata]),
      ),
    ],
  ).serialize();

  return (
    await axios.post(
      "https://testnet.query.wormhole.com/v1/query",
      { bytes: Buffer.from(request).toString("hex") },
      { headers: { "X-API-Key": API_KEY } },
    )
  ).data;
}
