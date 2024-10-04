import { StakeAccount, StakeConnection } from "../../app/StakeConnection";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
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
} from "@wormhole-foundation/wormhole-query-sdk";

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
  let stakeAccount =
    await stakeConnection.loadStakeAccount(stakeAccountCheckpointsAddress);
  const balanceSummary = stakeAccount.getBalanceSummary();
  assert.equal(balanceSummary.balance.toString(), expected.toString());
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
          [
            {
              to: "0x130Db1B83d205562461eD0720B37f1FBC21Bf67F", // 20-byte `to` address
              data: "0x01234567",
            },
          ], // call data
        ),
      ),
    ], // requests
  );

  // first results fields
  const contractAddress = hubProposalMetadata; // contract address (20 bytes)
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 60-byte array
  const result = new Uint8Array(60); // 20 + 32 + 8 = 60 bytes
  result.set(contractAddress, 0); // contract address (20 bytes)
  result.set(proposalId, 20); // proposal id (32 bytes)
  result.set(voteStart, 52); // vote start (8 bytes)

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
          [
            {
              to: "0x130Db1B83d205562461eD0720B37f1FBC21Bf67F", // 20-byte `to` address
              data: "0x01234567",
            },
          ], // call data
        ),
      ),
    ], // requests
  );

  // first results fields
  const contractAddress = hubProposalMetadata; // contract address (20 bytes)
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 60-byte array
  const result = new Uint8Array(60); // 20 + 32 + 8 = 60 bytes
  result.set(contractAddress, 0); // contract address (20 bytes)
  result.set(proposalId, 20); // proposal id (32 bytes)
  result.set(voteStart, 52); // vote start (8 bytes)

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
          [
            {
              to: "0x130Db1B83d205562461eD0720B37f1FBC21Bf67F", // 20-byte `to` address
              data: "0x01234567",
            },
          ], // call data
        ),
      ),
    ], // requests
  );

  // first results fields
  const contractAddress = hubProposalMetadata; // contract address (20 bytes)
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 60-byte array
  const result = new Uint8Array(60); // 20 + 32 + 8 = 60 bytes
  result.set(contractAddress, 0); // contract address (20 bytes)
  result.set(proposalId, 20); // proposal id (32 bytes)
  result.set(voteStart, 52); // vote start (8 bytes)

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
          [
            {
              to: "0x130Db1B83d205562461eD0720B37f1FBC21Bf67F", // 20-byte `to` address
              data: "0x01234567",
            },
          ], // call data
        ),
      ),
    ], // requests
  );

  // first results fields
  const contractAddress = hubProposalMetadata; // contract address (20 bytes)
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 60-byte array
  const result = new Uint8Array(60); // 20 + 32 + 8 = 60 bytes
  result.set(contractAddress, 0); // contract address (20 bytes)
  result.set(proposalId, 20); // proposal id (32 bytes)
  result.set(voteStart, 52); // vote start (8 bytes)

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
