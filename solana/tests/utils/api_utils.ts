import { StakeAccount, StakeConnection } from "../../app/StakeConnection";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { WHTokenBalance } from "../../app";
import assert from "assert";

/**
 * Asserts that `owner` has 1 single stake account and its balance summary is equal to an `expected` value
 */
export async function assertBalanceMatches(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expected: WHTokenBalance,
) {
  const stakeAccountAddress =
    await stakeConnection.getMainAccountAddress(owner);
  let stakeAccount =
    await stakeConnection.loadStakeAccount(stakeAccountAddress);
  const balanceSummary = stakeAccount.getBalanceSummary();
  assert.equal(balanceSummary.balance.toString(), expected.toString());
}


export function createAddProposalTestBytes(proposalIdInput: Uint8Array, voteStartInput: number): Uint8Array {
    // QueryResponse fields
    const version = new Uint8Array([1]); // version (1 byte)
    const requestChainId = new Uint8Array(new Uint16Array([1]).buffer); // request_chain_id (2 bytes)

    // Choose request_id length based on requestChainId (32 bytes here since request_chain_id != 0)
    const requestId = new Uint8Array(32).fill(3); // request_id (32 bytes for on-chain request)

    const requestLengthSkip = new Uint8Array(4).fill(0); // Skipped 4 bytes for request length

    // Simulate empty QueryRequest (can be replaced with actual data if needed)
    const queryRequest = new Uint8Array([0]); // Let's assume request is 1 byte for simplicity

    // Number of responses (1 response in this case)
    const numResponses = new Uint8Array([1]);

    // PerChainQueryResponse fields
    const chainId = new Uint8Array(new Uint16Array([1]).buffer); // chain_id (2 bytes)

    // EthCallQueryResponse fields
    const blockNumber = new Uint8Array(new BigUint64Array([BigInt(123456)]).buffer); // block_number (8 bytes)
    const blockHash = new Uint8Array(32).fill(0); // block_hash (32 bytes, example with zeros)
    const blockTime = new Uint8Array(new BigUint64Array([BigInt(Date.now())]).buffer); // block_time (8 bytes)

    // EthCallQueryResponse results (example: one result as the 60-byte array)
    const contractAddress = new Uint8Array(20).fill(1); // contract_address (20 bytes)
    const proposalId = proposalIdInput; // proposal_id (32 bytes)
    const voteStart = new Uint8Array(new BigUint64Array([BigInt(voteStartInput)]).buffer);; // vote_start (8 bytes)

    // Combine all parts into the result array
    const result = new Uint8Array(60); // 20 + 32 + 8 = 60 bytes
    result.set(contractAddress, 0);    // contract_address (20 bytes)
    result.set(proposalId, 20);        // proposal_id (32 bytes)
    result.set(voteStart, 52);         // vote_start (8 bytes)

    const results = [result]; // One result for EthCallQueryResponse

    // Prepare EthCallQueryResponse structure in bytes
    const ethCallQueryResponse = new Uint8Array(48 + results[0].length);
    ethCallQueryResponse.set(blockNumber, 0); // block_number (8 bytes)
    ethCallQueryResponse.set(blockHash, 8); // block_hash (32 bytes)
    ethCallQueryResponse.set(blockTime, 40); // block_time (8 bytes)
    ethCallQueryResponse.set(results[0], 48); // first result in results array

    // PerChainQueryResponse (chain_id + EthCallQueryResponse)
    const perChainQueryResponse = new Uint8Array(2 + ethCallQueryResponse.length);
    perChainQueryResponse.set(chainId, 0); // chain_id (2 bytes)
    perChainQueryResponse.set(ethCallQueryResponse, 2); // EthCallQueryResponse data

    // QueryResponse (version + request_chain_id + request_id + skip + request + responses)
    const queryResponse = new Uint8Array(
        version.length +
        requestChainId.length +
        requestId.length +
        requestLengthSkip.length +
        queryRequest.length +
        numResponses.length +
        perChainQueryResponse.length
    );

    queryResponse.set(version, 0); // version (1 byte)
    queryResponse.set(requestChainId, 1); // request_chain_id (2 bytes)
    queryResponse.set(requestId, 3); // request_id (32 bytes in this case)
    queryResponse.set(requestLengthSkip, 35); // skip 4 bytes for request length
    queryResponse.set(queryRequest, 39); // request (1 byte in this example)
    queryResponse.set(numResponses, 40); // number of responses (1 byte)
    queryResponse.set(perChainQueryResponse, 41); // first PerChainQueryResponse

    return queryResponse;
}
