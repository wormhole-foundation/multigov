import { StakeConnection } from "../../app/StakeConnection";
import { PublicKey } from "@solana/web3.js";
import { WHTokenBalance } from "../../app";
import {
  HUB_CHAIN_ID,
  HUB_PROPOSAL_METADATA_ADDRESS,
} from "./constants";
import assert from "assert";
import {
  QueryRequest,
  PerChainQueryRequest,
  EthCallQueryRequest,
  EthCallWithFinalityQueryRequest,
  QueryResponse,
  PerChainQueryResponse,
  EthCallQueryResponse,
  EthCallWithFinalityQueryResponse,
  uint8ArrayToHex,
  EthCallData,
} from "@wormhole-foundation/wormhole-query-sdk";
import { ethers } from "ethers";

function encodeSignature(signature: string): string {
  return ethers.id(signature).substring(0, 10);
}

function toUint256Bytes(value: number): Uint8Array {
  const bigIntValue = BigInt(value);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    // Fill from the end, because the lowest bytes must be at the end (big-endian)
    bytes[31 - i] = Number((bigIntValue >> BigInt(i * 8)) & BigInt(0xff));
  }
  return bytes;
}

/**
 * Asserts that `owner` has 1 single stake account and its balance summary is equal to an `expected` value
 */
export async function assertBalanceMatches(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expected: WHTokenBalance,
) {
  let stakeAccountMetadataAddress =
    await stakeConnection.getStakeMetadataAddress(owner);
  let stakeAccountCheckpointsAddress =
    await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
      stakeAccountMetadataAddress,
      false,
    );
  let stakeAccount = await stakeConnection.loadStakeAccount(
    stakeAccountCheckpointsAddress,
  );
  const balanceSummary = stakeAccount.getBalanceSummary();
  assert.equal(balanceSummary.balance.toString(), expected.toString());
}

function getQueryRequestCalldata(proposalIdInput: Uint8Array): EthCallData {
  const encodedSignature = encodeSignature("getProposalMetadata(uint256)");

  const calldata: EthCallData = {
    to: HUB_PROPOSAL_METADATA_ADDRESS,
    data: encodedSignature + Buffer.from(proposalIdInput).toString("hex"),
  };

  return calldata;
}

function getQueryRequestCalldataWithInvalidFunctionSignature(
  proposalIdInput: Uint8Array,
): EthCallData {
  const encodedSignature = encodeSignature(
    "getInvalidProposalMetadata(uint256)",
  );

  const calldata: EthCallData = {
    to: HUB_PROPOSAL_METADATA_ADDRESS,
    data: encodedSignature + Buffer.from(proposalIdInput).toString("hex"),
  };

  return calldata;
}

export function createProposalQueryResponseBytes(
  proposalIdInput: Uint8Array,
  voteStartInput: number,
): Uint8Array {
  const queryRequest = new QueryRequest(
    42, // nonce
    [
      new PerChainQueryRequest(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryRequest(
          987654, // block number
          "finalized",
          [getQueryRequestCalldata(proposalIdInput)],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = toUint256Bytes(voteStartInput); // vote start (32 bytes)

  // one result as the 64-byte array
  const result = new Uint8Array(64); // 32 + 32 = 64 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (32 bytes)

  const serializedQueryResponse = new QueryResponse(
    HUB_CHAIN_ID, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryResponse(
          BigInt(987654), // block number
          "0x123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123a", // block hash
          BigInt(Date.now()), // block time
          [uint8ArrayToHex(result)], // results
        ),
      ),
    ],
  ).serialize();

  return serializedQueryResponse;
}

export function createNonFinalizedProposalQueryResponseBytes(
  proposalIdInput: Uint8Array,
  voteStartInput: number,
): Uint8Array {
  const queryRequest = new QueryRequest(
    42, // nonce
    [
      new PerChainQueryRequest(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryRequest(
          987654, // block number
          "safe",
          [getQueryRequestCalldata(proposalIdInput)],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = toUint256Bytes(voteStartInput); // vote start (32 bytes)

  // one result as the 64-byte array
  const result = new Uint8Array(64); // 32 + 32 = 64 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (32 bytes)

  const serializedQueryResponse = new QueryResponse(
    HUB_CHAIN_ID, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryResponse(
          BigInt(987654), // block number
          "0x123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123a", // block hash
          BigInt(Date.now()), // block time
          [uint8ArrayToHex(result)], // results
        ),
      ),
    ],
  ).serialize();

  return serializedQueryResponse;
}

export function createProposalQueryResponseBytesWithInvalidChainSpecificQuery(
  proposalIdInput: Uint8Array,
  voteStartInput: number,
): Uint8Array {
  const queryRequest = new QueryRequest(
    42, // nonce
    [
      new PerChainQueryRequest(
        HUB_CHAIN_ID, // chain id
        new EthCallQueryRequest(
          987654, // block number
          [getQueryRequestCalldata(proposalIdInput)],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = toUint256Bytes(voteStartInput); // vote start (32 bytes)

  // one result as the 64-byte array
  const result = new Uint8Array(64); // 32 + 32 = 64 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (32 bytes)

  const serializedQueryResponse = new QueryResponse(
    HUB_CHAIN_ID, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        HUB_CHAIN_ID, // chain id
        new EthCallQueryResponse(
          BigInt(987654), // block number
          "0x123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123a", // block hash
          BigInt(Date.now()), // block time
          [uint8ArrayToHex(result)], // results
        ),
      ),
    ],
  ).serialize();

  return serializedQueryResponse;
}

export function createProposalQueryResponseBytesWithInvalidChainSpecificResponse(
  proposalIdInput: Uint8Array,
  voteStartInput: number,
): Uint8Array {
  const queryRequest = new QueryRequest(
    42, // nonce
    [
      new PerChainQueryRequest(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryRequest(
          987654, // block number
          "finalized",
          [getQueryRequestCalldata(proposalIdInput)],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = toUint256Bytes(voteStartInput); // vote start (32 bytes)

  // one result as the 64-byte array
  const result = new Uint8Array(64); // 32 + 32 = 64 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (32 bytes)

  const serializedQueryResponse = new QueryResponse(
    HUB_CHAIN_ID, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        HUB_CHAIN_ID, // chain id
        new EthCallQueryResponse(
          BigInt(987654), // block number
          "0x123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123a", // block hash
          BigInt(Date.now()), // block time
          [uint8ArrayToHex(result)], // results
        ),
      ),
    ],
  ).serialize();

  return serializedQueryResponse;
}

export function createProposalQueryResponseBytesWithInvalidFunctionSignature(
  proposalIdInput: Uint8Array,
  voteStartInput: number,
): Uint8Array {
  const queryRequest = new QueryRequest(
    42, // nonce
    [
      new PerChainQueryRequest(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryRequest(
          987654, // block number
          "finalized",
          [
            getQueryRequestCalldataWithInvalidFunctionSignature(
              proposalIdInput,
            ),
          ],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = toUint256Bytes(voteStartInput); // vote start (32 bytes)

  // one result as the 64-byte array
  const result = new Uint8Array(64); // 32 + 32 = 64 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (32 bytes)

  const serializedQueryResponse = new QueryResponse(
    HUB_CHAIN_ID, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        HUB_CHAIN_ID, // chain id
        new EthCallWithFinalityQueryResponse(
          BigInt(987654), // block number
          "0x123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123a", // block hash
          BigInt(Date.now()), // block time
          [uint8ArrayToHex(result)], // results
        ),
      ),
    ],
  ).serialize();

  return serializedQueryResponse;
}
