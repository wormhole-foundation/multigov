// Usage: npx ts-node app/deploy/bridge-script.ts

import {
  EthCallData,
  EthCallWithFinalityQueryRequest,
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

async function getLatestFinalizedBlock(rpc: string): Promise<number> {
  return (
    await axios.post(rpc, {
      method: "eth_getBlockByNumber",
      params: ["finalized", false],
      id: 1,
      jsonrpc: "2.0",
    })
  ).data?.result?.number;
}

async function main() {
  const chain = 10002;

  const rpc = process.env[`RPC_${chain}`];

  if (!rpc) {
    throw new Error(`RPC endpoint not found for chain ${chain}`);
  }

  const latestBlock = await getLatestFinalizedBlock(rpc);
  console.log("latestBlock:", parseInt(latestBlock.toString(), 16));
}

main();
