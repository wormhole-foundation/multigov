import { StakeAccount, StakeConnection } from "../../app/StakeConnection";
import { PublicKey } from "@solana/web3.js";
import { WHTokenBalance } from "../../app";
import { hubChainId, hubProposalMetadata } from "../../app/constants";
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
  return ethers.id(signature).substring(0, 10)
}

/**
 * Asserts that `owner` has 1 single stake account and its balance summary is equal to an `expected` value
 */
export async function assertBalanceMatches(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expected: WHTokenBalance,
) {
  const stakeAccountCheckpointsAddress =
    await stakeConnection.getStakeAccountCheckpointsAddress(owner);
  let stakeAccount = await stakeConnection.loadStakeAccount(
    stakeAccountCheckpointsAddress,
  );
  const balanceSummary = stakeAccount.getBalanceSummary();
  assert.equal(balanceSummary.balance.toString(), expected.toString());
}

function getQueryRequestCalldata(proposalIdInput: Uint8Array): EthCallData {
  const contractAddress = "0x2574802Db8590ee5C9EFC5eBeBFef1E174b712FC"; // HubProposalMetadata address
  const encodedSignature = encodeSignature("getProposalMetadata(uint256)");

  const calldata: EthCallData = {
    to: contractAddress,
    data: encodedSignature + Buffer.from(proposalIdInput).toString('hex'),
  };

  return calldata;
}

function getQueryRequestCalldataWithInvalidFunctionSignature(proposalIdInput: Uint8Array): EthCallData {
  const contractAddress = "0x2574802Db8590ee5C9EFC5eBeBFef1E174b712FC"; // HubProposalMetadata address
  const encodedSignature = encodeSignature("getInvalidProposalMetadata(uint256)");

  const calldata: EthCallData = {
    to: contractAddress,
    data: encodedSignature + Buffer.from(proposalIdInput).toString('hex'),
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
        hubChainId, // chain id
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
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 60-byte array
  const result = new Uint8Array(40); // 32 + 8 = 60 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (8 bytes)

  const serializedQueryResponse = new QueryResponse(
    hubChainId, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        hubChainId, // chain id
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
        hubChainId, // chain id
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
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 40-byte array
  const result = new Uint8Array(40); // 32 + 8 = 40 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (8 bytes)

  const serializedQueryResponse = new QueryResponse(
    hubChainId, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        hubChainId, // chain id
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
        hubChainId, // chain id
        new EthCallQueryRequest(
          987654, // block number
          [getQueryRequestCalldata(proposalIdInput)],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 40-byte array
  const result = new Uint8Array(40); // 32 + 8 = 40 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (8 bytes)

  const serializedQueryResponse = new QueryResponse(
    hubChainId, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        hubChainId, // chain id
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
        hubChainId, // chain id
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
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 40-byte array
  const result = new Uint8Array(40); // 32 + 8 = 60 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (8 bytes)

  const serializedQueryResponse = new QueryResponse(
    hubChainId, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        hubChainId, // chain id
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
        hubChainId, // chain id
        new EthCallWithFinalityQueryRequest(
          987654, // block number
          "finalized",
          [getQueryRequestCalldataWithInvalidFunctionSignature(proposalIdInput)],
        ),
      ),
    ], // requests
  );

  // first results fields
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 40-byte array
  const result = new Uint8Array(40); // 32 + 8 = 40 bytes
  result.set(proposalId, 0); // proposal id (32 bytes)
  result.set(voteStart, 32); // vote start (8 bytes)

  const serializedQueryResponse = new QueryResponse(
    hubChainId, // chain id
    Buffer.from(new Array(32).fill(3)).toString("hex"), // request id (32 bytes for on-chain request since chainId != 0)
    queryRequest,
    [
      new PerChainQueryResponse(
        hubChainId, // chain id
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

