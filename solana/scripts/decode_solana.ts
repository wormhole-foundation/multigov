import { ethers } from 'ethers';
import * as fs from 'fs';
import 'dotenv/config';
import { PublicKey } from '@solana/web3.js';
import axios from "axios";
import {
    PerChainQueryRequest,
    QueryProxyQueryResponse,
    QueryRequest,
    QueryResponse,
    SolanaPdaQueryRequest,
    SolanaPdaQueryResponse,
    signaturesToEvmStruct
  } from "@wormhole-foundation/wormhole-query-sdk";

const contractAddress = '0xba462aebd85c8de4c6f7c70048a8dec133d2b3b6'; // HubSolanaSpokeVoteDecoder
const contractABIPath = './script/ABI/HubSolanaSpokeVoteDecoder.json';

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.SEPOLIA_RPC_URL;

const contractABI = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

const QUERY_URL = "https://testnet.query.wormhole.com/v1/query";
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY is required");
}

const PROGRAM_ID = new PublicKey('8t5PooRwQTcmN7BP5gsGeWSi3scvoaPqFifNi2Bnnw4g'); 
const SEED1 = 'proposal';
const SEED2 = '107524253878028098533770440336162529987916725531746959312330912271441391631104'; // proposal_id
const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED1), uint256ToBuffer(SEED2)],
    PROGRAM_ID
    );

export interface SolanaPdaEntry {
    programAddress: Uint8Array;
    seeds: Uint8Array[];
}

function uint256ToBuffer(uint256) {
    const bigIntValue = BigInt(uint256);
    const buffer = Buffer.alloc(32);
    let hexValue = bigIntValue.toString(16).padStart(64, '0');
    buffer.write(hexValue, 'hex');
    return buffer;
}

async function querySolana(): Promise<{ bytes: string, signatures: any[] }> {

    const pdas: SolanaPdaEntry[] = [{programAddress: PROGRAM_ID.toBuffer(), seeds: [Buffer.from(SEED1), uint256ToBuffer(SEED2)]}];

    console.log("Program ID: ", Uint8Array.from(PROGRAM_ID.toBuffer()));

    const query = new QueryRequest(42, [
        new PerChainQueryRequest(
          1,
          new SolanaPdaQueryRequest(
            "finalized",
            pdas
          )
        ),
      ]);
      const serialized = Buffer.from(query.serialize()).toString("hex");
  
      console.log("Query request: ", serialized);
  
      const resp = (
        await axios.post<QueryProxyQueryResponse>(
          QUERY_URL,
          { bytes: serialized },
          { headers: { "X-API-Key": API_KEY } }
        )
      ).data;
      
      console.log("Query response: ", resp);
      const queryResponse = QueryResponse.from(Buffer.from(resp.bytes, "hex"));

      const bytes = "0x" + resp['bytes'];
      const signatures = resp['signatures'];
      console.log("bytes: ", bytes);
      console.log("signatures: ", signatures);

      return { bytes, signatures };
    
}

async function decodeSolana(): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey!, provider);

    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    const {bytes, signatures} = await querySolana();
    const governerAddress = "0xbf56492fc04ec0b09b194cfca62a65f8167cd363";

    const guardianSignatures = signaturesToEvmStruct(signatures);

    console.log('guardianSignatures: ', guardianSignatures);

    console.log('Parse and Verify rawdata...');
    const result1 = await contract.parseAndVerifyQueryResponse.staticCall(bytes, guardianSignatures);
    let pda_response = [...result1.responses[0]];  
    console.log(pda_response);

    console.log('parseSolanaPdaQueryResponse...');
    const result2 = await contract.parseSolanaPdaQueryResponse.staticCall(pda_response);
    console.log(result2);

    console.log('Decode...');
    const result3 = await contract.decode.staticCall(
        pda_response,
        governerAddress
    );
    console.log(result3);
  } catch (error) {
    console.error(error);
  }
}

decodeSolana();