// npx jest scripts/solana.test.ts
import { describe, expect, jest, test } from "@jest/globals";
import axios, { AxiosError, AxiosResponse } from "axios";
import bs58 from 'bs58';
import {
    PerChainQueryRequest,
    QueryProxyQueryResponse,
    QueryRequest,
    QueryResponse,
    SolanaPdaQueryRequest,
    SolanaPdaQueryResponse,
    signaturesToEvmStruct,
    SolanaPdaEntry,
    ChainQueryType,
    sign
  } from "@wormhole-foundation/wormhole-query-sdk";
import { ethers } from 'ethers';
import 'dotenv/config';

const API_KEY = process.env.WORMHOLE_API_KEY as string;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

jest.setTimeout(12500);

export interface ProposalData {
    id: Uint8Array;
    againstVotes: bigint;
    forVotes: bigint;
    abstainVotes: bigint;
    voteStart: bigint;
  }

const ENV = "DEVNET";
const SEPOLIA_RPC_URL = "https://1rpc.io/sepolia";
const SOLANA_NODE_URL = "https://api.devnet.solana.com/";
const QUERY_URL = "https://testnet.query.wormhole.com/v1/query";
const PROGRAM_ID: string = "8t5PooRwQTcmN7BP5gsGeWSi3scvoaPqFifNi2Bnnw4g";
const PROPOSAL_ID = "1902168547689912375021230644053282215236273317930551854899821863298318218191";

const DECODER_ADDRESS = '0xba462aebd85c8de4c6f7c70048a8dec133d2b3b6'; // HubSolanaSpokeVoteDecoder
const DECODER_ABI = [
    {
        "type": "function",
        "name": "parseAndVerifyQueryResponse",
        "inputs": [
          {
            "name": "response",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "signatures",
            "type": "tuple[]",
            "internalType": "struct IWormhole.Signature[]",
            "components": [
              {
                "name": "r",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "s",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "v",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "guardianIndex",
                "type": "uint8",
                "internalType": "uint8"
              }
            ]
          }
        ],
        "outputs": [
      {
        "name": "r",
        "type": "tuple",
        "internalType": "struct ParsedQueryResponse",
        "components": [
          {
            "name": "version",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "senderChainId",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "nonce",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "requestId",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "responses",
            "type": "tuple[]",
            "internalType": "struct ParsedPerChainQueryResponse[]",
            "components": [
              {
                "name": "chainId",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "queryType",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "request",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "response",
                "type": "bytes",
                "internalType": "bytes"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
      }
];

// Save Jest from circular axios errors
axios.interceptors.response.use(
    (r) => r,
    (err: AxiosError) => {
      const error = new Error(
        `${err.message}${err?.response?.data ? `: ${err.response.data}` : ""}`
      ) as any;
      error.response = err.response
        ? { data: err.response.data, status: err.response.status }
        : undefined;
      throw error;
    }
  );

function uint256ToBuffer(uint256) {
    const bigIntValue = BigInt(uint256);
    const buffer = Buffer.alloc(32);
    let hexValue = bigIntValue.toString(16).padStart(64, '0');
    buffer.write(hexValue, 'hex');
    return buffer;
}

const PDAS: SolanaPdaEntry[] = [
    {
      programAddress: Uint8Array.from(
        bs58.decode(PROGRAM_ID)
      ), // solana address
      seeds: [
        new Uint8Array(Buffer.from("proposal")),
        new Uint8Array(uint256ToBuffer(PROPOSAL_ID)),
      ], // Use index zero in tilt.
    },
  ];

async function getSolanaSlot(comm: string): Promise<bigint> {
const response = await axios.post(SOLANA_NODE_URL, {
    jsonrpc: "2.0",
    id: 1,
    method: "getSlot",
    params: [{ commitment: comm, transactionDetails: "none" }],
});

return response.data.result;
}

/**
 * Decodes ProposalData from a Buffer
 * @param data The buffer containing the ProposalData
 * @returns Decoded ProposalData object
 */
function decodeProposalData(data: Buffer): ProposalData {
    if (data.length !== 72) {
      throw new Error(`Invalid data length. Expected 72 bytes, got ${data.length}`);
    }

    let offset = 8;  // descriptor

    const readId = (): Uint8Array => {
      const id = new Uint8Array(data.subarray(offset, offset + 32));
      offset += 32;
      return id;
    };

    const readBigUInt64LE = (): bigint => {
      const value = data.readBigUInt64LE(offset);
      offset += 8;
      return value;
    };

    return {
      id: readId(),
      againstVotes: readBigUInt64LE(),
      forVotes: readBigUInt64LE(),
      abstainVotes: readBigUInt64LE(),
      voteStart: readBigUInt64LE(),
    };
  }

describe("solana", () => {
    test("serialize and deserialize sol_pda request with defaults", () => {
        const solPdaReq = new SolanaPdaQueryRequest(
          "finalized",
          PDAS,
          BigInt(123456),
          BigInt(12),
          BigInt(20)
        );
        expect(solPdaReq.minContextSlot.toString()).toEqual(
          BigInt(123456).toString()
        );
        expect(solPdaReq.dataSliceOffset.toString()).toEqual(BigInt(12).toString());
        expect(solPdaReq.dataSliceLength.toString()).toEqual(BigInt(20).toString());
        const serialized = solPdaReq.serialize();
        expect(Buffer.from(serialized).toString("hex")).toEqual(
          "0000000966696e616c697a6564000000000001e240000000000000000c000000000000001401751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d45020000000870726f706f73616c00000020043496d8c4716e71a34fd417c930a508e2e20536c653fb89501354fdd31c33cf"
        );
        const solPdaReq2 = SolanaPdaQueryRequest.from(serialized);
        expect(solPdaReq2).toEqual(solPdaReq);
      });

      test("deserialize sol_pda response", () => {
        const respBytes = Buffer.from(
          "0100000c8418d81c00aad6283ba3eb30e141ccdd9296e013ca44e5cc713418921253004b93107ba0d858a548ce989e2bca4132e4c2f9a57a9892e3a87a8304cdb36d8f000000006b010000002b010001050000005e0000000966696e616c697a656400000000000008ff000000000000000c00000000000000140102c806312cbe5b79ef8aa6c17e3f423d8fdfe1d46909fb1f6cdf65ee8e2e6faa020000000b477561726469616e5365740000000400000000010001050000009b00000000000008ff0006115e3f6d7540e05035785e15056a8559815e71343ce31db2abf23f65b19c982b68aee7bf207b014fa9188b339cfd573a0778c5deaeeee94d4bcfb12b345bf8e417e5119dae773efd0000000000116ac000000000000000000002c806312cbe5b79ef8aa6c17e3f423d8fdfe1d46909fb1f6cdf65ee8e2e6faa0000001457cd18b7f8a4d91a2da9ab4af05d0fbece2dcd65",
          "hex"
        );
        const queryResponse = QueryResponse.from(respBytes);
        expect(queryResponse.version).toEqual(1);
        expect(queryResponse.requestChainId).toEqual(0);
        expect(queryResponse.request.version).toEqual(1);
        expect(queryResponse.request.requests.length).toEqual(1);
        expect(queryResponse.request.requests[0].chainId).toEqual(1);
        expect(queryResponse.request.requests[0].query.type()).toEqual(
          ChainQueryType.SolanaPda
        );

        const sar = queryResponse.responses[0].response as SolanaPdaQueryResponse;

        expect(sar.slotNumber.toString()).toEqual(BigInt(2303).toString());
        expect(sar.blockTime.toString()).toEqual(
          BigInt(0x0006115e3f6d7540).toString()
        );
        expect(sar.results.length).toEqual(1);

        expect(Buffer.from(sar.results[0].account).toString("hex")).toEqual(
          "4fa9188b339cfd573a0778c5deaeeee94d4bcfb12b345bf8e417e5119dae773e"
        );
        expect(sar.results[0].bump).toEqual(253);
        expect(sar.results[0].lamports.toString()).not.toEqual(
          BigInt(0).toString()
        );
        expect(sar.results[0].rentEpoch.toString()).toEqual(BigInt(0).toString());
        expect(sar.results[0].executable).toEqual(false);
        expect(Buffer.from(sar.results[0].owner).toString("hex")).toEqual(
          "02c806312cbe5b79ef8aa6c17e3f423d8fdfe1d46909fb1f6cdf65ee8e2e6faa"
        );
        expect(Buffer.from(sar.results[0].data).toString("hex")).toEqual(
          "57cd18b7f8a4d91a2da9ab4af05d0fbece2dcd65"
        );
      });

      test("successful proposal data decoding", async () => { 
        const sampleProposalData = Buffer.from(
            'c2567bac921cbff4043496d8c4716e71a34fd417c930a508e2e20536c653fb89501354fdd31c33cf0a0000000000000014000000000000000c00000000000000e21c186700000000',
            'hex'
            );
        const decodedProposalData = decodeProposalData(sampleProposalData);
        expect(decodedProposalData.id).toEqual(new Uint8Array(uint256ToBuffer(PROPOSAL_ID)));
        expect(decodedProposalData.againstVotes).toEqual(BigInt(10));
        expect(decodedProposalData.forVotes).toEqual(BigInt(20));
        expect(decodedProposalData.abstainVotes).toEqual(BigInt(12));
      });

      test("successful sol_pda query", async () => {
        const currSlot = await getSolanaSlot("finalized");
        const minContextSlot = BigInt(currSlot) + BigInt(10);
        const solPdaReq = new SolanaPdaQueryRequest(
          "finalized",
          PDAS,
        );
        const nonce = 42;
        const query = new PerChainQueryRequest(1, solPdaReq);
        const request = new QueryRequest(nonce, [query]);
        const serialized = request.serialize();
        const serializedBytes = Buffer.from(serialized).toString("hex");

        const response = await axios.post<QueryProxyQueryResponse>(
          QUERY_URL,
          { bytes: serializedBytes },
          { headers: { "X-API-Key": API_KEY } }
        );
        expect(response.status).toBe(200);

        const queryResponse = QueryResponse.from(response.data.bytes);
        expect(queryResponse.version).toEqual(1);
        expect(queryResponse.requestChainId).toEqual(0);
        expect(queryResponse.request.version).toEqual(1);
        expect(queryResponse.request.requests.length).toEqual(1);
        expect(queryResponse.request.requests[0].chainId).toEqual(1);
        expect(queryResponse.request.requests[0].query.type()).toEqual(
          ChainQueryType.SolanaPda
        );

        const sar = queryResponse.responses[0].response as SolanaPdaQueryResponse;

        expect(sar.slotNumber.toString()).not.toEqual(BigInt(0).toString());
        expect(sar.blockTime.toString()).not.toEqual(BigInt(0).toString());
        expect(sar.results.length).toEqual(1);

        expect(Buffer.from(sar.results[0].account).toString("hex")).toEqual(
          "0849e1f377e148020e0e98098173c4ad3dd15dac67d61172907e312e1c6aec3b"
        );
        expect(sar.results[0].bump).toEqual(254);
        expect(sar.results[0].executable).toEqual(false);
        expect(Buffer.from(sar.results[0].owner).toString("hex")).toEqual(
          "751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d45"
        );
        expect(Buffer.from(sar.results[0].data).toString("hex")).toEqual(
          "c2567bac921cbff4043496d8c4716e71a34fd417c930a508e2e20536c653fb89501354fdd31c33cf0a0000000000000014000000000000000c00000000000000e21c186700000000"
        );
      });

      test("successful proposal data parse and verify onchain", async () => { 
        const sampleQueryData = '0x010000251fb17c5d050dd80512dc39fa8b2d7ae112a21a042b8ba5b02125ab0e750fef2b985b0cd6ca2f62787565b7a2387372b6d69b4a6fa2845fcd745e865fd4c3810000000084010000002a01000105000000770000000966696e616c697a656400000000000000000000000000000000000000000000000001751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d45020000000870726f706f73616c00000020043496d8c4716e71a34fd417c930a508e2e20536c653fb89501354fdd31c33cf01000105000000cf0000000013fe5e750006254fd1eedbc075cf3ed4922218c247b470853b3a4d69ca0a7556dc0fe3b4446df1571e96ea86010849e1f377e148020e0e98098173c4ad3dd15dac67d61172907e312e1c6aec3bfe0000000000153d80ffffffffffffffff00751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d4500000048c2567bac921cbff4043496d8c4716e71a34fd417c930a508e2e20536c653fb89501354fdd31c33cf0a0000000000000014000000000000000c00000000000000e21c186700000000';

        const sampleGuardianSignatures = [
            'b621c555e0fea20ed854c3c78976e31e9f0287599c2fe8205ce79e8c35f1af436ffc57df02232f1657d0e7fc83ce5a3286c8845a545fa55bf16859fa159d2b1b0000',
        ];

        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);

        const contract = new ethers.Contract(DECODER_ADDRESS, DECODER_ABI, wallet);

        const guardianSignatures = signaturesToEvmStruct(sampleGuardianSignatures);

        // console.log('guardianSignatures: ', guardianSignatures);

        // console.log('Parse and Verify rawdata...');
        const parsed = await contract.parseAndVerifyQueryResponse.staticCall(sampleQueryData, guardianSignatures);

        expect(parsed[0]).toEqual(BigInt(1));
        expect(parsed[1]).toEqual(BigInt(0));
        expect(parsed[2]).toEqual(BigInt(42));
      });
});

// npx jest scripts/solana.test.ts
//  PASS  scripts/solana.test.ts
//   solana
//     ✓ serialize and deserialize sol_pda request with defaults (6 ms)
//     ✓ deserialize sol_pda response (2 ms)
//     ✓ successful proposal data decoding (1 ms)
//     ✓ successful sol_pda query (558 ms)
//     ✓ successful proposal data parse and verify onchain (726 ms)
// 
// Test Suites: 1 passed, 1 total
// Tests:       5 passed, 5 total
// Snapshots:   0 total
// Time:        4.242 s, estimated 5 s
// Ran all test suites matching /scripts\/solana.test.ts/i.

