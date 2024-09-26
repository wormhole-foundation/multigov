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

export function createAddProposalTestBytes(
  proposalIdInput: Uint8Array,
  voteStartInput: number,
): Uint8Array {
  const version = new Uint8Array([1]); // QueryRequest and QueryResponse version (1 byte)
  const chainId = new Uint8Array(new Uint16Array([1]).buffer); // Blockchain ID (2 bytes)

  // queryType == 1 corresponds to ChainSpecificResponse::EthCallQueryResponse
  // and ChainSpecificQuery::EthCallQueryRequest
  const queryType = new Uint8Array([1]); // query type (1 byte)

  // Choose requestId length based on chainId (32 bytes here since chainId != 0)
  const requestId = new Uint8Array(32).fill(3); // request id (32 bytes for on-chain request)

  // QueryRequest fields
  const nonce = new Uint8Array(new Uint32Array([12345]).buffer); // nonce (4 bytes)
  const numRequests = new Uint8Array([1]); // number of requests (1 byte)

  const blockId = 12345;
  const blockTagString = `0x${blockId.toString(16)}`; // block tag string
  const blockTagLength = new Uint8Array(new Uint32Array([blockTagString.length]).buffer); // length of block tag (4 bytes)
  const blockTag = new Uint8Array(Buffer.from(blockTagString)); // block tag

  const callDataLength = new Uint8Array([1]); // length of call data (1 bytes)
  const dataLength = new Uint8Array(new Uint32Array([1]).buffer); // length of data (4 bytes)
  const callDataTo = [0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78]; // 20-byte `to` address
  const callDataData = [0xde]; // data

  // Prepare EthCallQueryRequest structure in bytes (blockTagLength + blockTag + callDataLength + callDataTo + dataLength + callDataData)
  const ethCallQueryRequest = new Uint8Array(4 + blockTagString.length + 1 + 20 + 4 + 1);
  ethCallQueryRequest.set(blockTagLength, 0); // length of block tag (4 bytes)
  ethCallQueryRequest.set(blockTag, 4); // block tag (blockTagString.length bytes)
  ethCallQueryRequest.set(callDataLength, 4 + blockTagString.length); // length of call data (1 bytes)
  ethCallQueryRequest.set(callDataTo, 4 + blockTagString.length + 1); // callDataTo (20 bytes)
  ethCallQueryRequest.set(dataLength, 4 + blockTagString.length + 1 + 20); // length of callDataData (4 bytes)
  ethCallQueryRequest.set(callDataData, 4 + blockTagString.length + 1 + 20 + 4); // callDataData (1 byte)

  const ethCallQueryRequestLength = new Uint8Array(new Uint32Array([ethCallQueryRequest.length]).buffer);

  // Prepare PerChainQueryRequest structure in bytes (chain_id + queryType + ethCallQueryRequestLength + ethCallQueryRequest)
  const perChainQueryRequest = new Uint8Array(2 + 1 + 4 + ethCallQueryRequest.length);
  perChainQueryRequest.set(chainId, 0); // chain id (2 bytes)
  perChainQueryRequest.set(queryType, 2); // query type (1 byte)
  perChainQueryRequest.set(ethCallQueryRequestLength, 3); // length of ethCallQueryRequest (4 bytes)
  perChainQueryRequest.set(ethCallQueryRequest, 7); // ethCallQueryRequest

  // Prepare QueryRequest structure in bytes (version + nonce + numRequests + perChainQueryRequest)
  const queryRequest = new Uint8Array(
      version.length +
      nonce.length +
      numRequests.length +
      perChainQueryRequest.length
  );

  queryRequest.set(version, 0); // version (1 byte)
  queryRequest.set(nonce, 1); // nonce (4 bytes)
  queryRequest.set(numRequests, 5); // number of requests (1 byte)
  queryRequest.set(perChainQueryRequest, 6); // request (2 bytes)

  const queryRequestLength = new Uint8Array(new Uint32Array([queryRequest.length]).buffer); // queryRequest length (4 bytes)

  // Number of responses (1 response in this case)
  const numResponses = new Uint8Array([1]);

  // EthCallQueryResponse fields
  const blockNumber = new Uint8Array(
    new BigUint64Array([BigInt(123456)]).buffer,
  ); // block number (8 bytes)
  const blockHash = new Uint8Array(32).fill(1); // block hash (32 bytes)
  const blockTime = new Uint8Array(
    new BigUint64Array([BigInt(Date.now())]).buffer,
  ); // block time (8 bytes)

  // first results fields
  const contractAddress = new Uint8Array(20).fill(1); // contract address (20 bytes)
  const proposalId = proposalIdInput; // proposal id (32 bytes)
  const voteStart = new Uint8Array(
    new BigUint64Array([BigInt(voteStartInput)]).buffer,
  ); // vote start (8 bytes)

  // one result as the 60-byte array
  const result = new Uint8Array(60); // 20 + 32 + 8 = 60 bytes
  result.set(contractAddress, 0); // contract address (20 bytes)
  result.set(proposalId, 20); // proposal id (32 bytes)
  result.set(voteStart, 52); // vote start (8 bytes)

  const numResults = new Uint8Array([1]);
  const resultLength = new Uint8Array(new Uint32Array([result.length]).buffer);

  // Prepare EthCallQueryResponse structure in bytes
  const ethCallQueryResponse = new Uint8Array(8 + 32 + 8 + 1 + 4 + result.length);
  ethCallQueryResponse.set(blockNumber, 0); // block number (8 bytes)
  ethCallQueryResponse.set(blockHash, 8); // block hash (32 bytes)
  ethCallQueryResponse.set(blockTime, 40); // block time (8 bytes)
  ethCallQueryResponse.set(numResults, 48); // number of results (1 byte)
  ethCallQueryResponse.set(resultLength, 49); // result length (4 bytes)
  ethCallQueryResponse.set(result, 53); // result

  // PerChainQueryResponse fields
  const ethCallQueryResponseLength = new Uint8Array(new Uint32Array([ethCallQueryResponse.length]).buffer);

  // Prepare PerChainQueryResponse structure in bytes (chain_id + query_type + ethCallQueryResponseLength + EthCallQueryResponse)
  const perChainQueryResponse = new Uint8Array(2 + 1 + 4 + ethCallQueryResponse.length);
  perChainQueryResponse.set(chainId, 0); // chain id (2 bytes)
  perChainQueryResponse.set(queryType, 2); // query type (1 byte)
  perChainQueryResponse.set(ethCallQueryResponseLength, 3); // response length (4 bytes)
  perChainQueryResponse.set(ethCallQueryResponse, 7); // EthCallQueryResponse data

  // QueryResponse (version + chainId + requestId + queryRequestLength + queryRequest + numResponses + responses)
  const queryResponse = new Uint8Array(
    version.length +
      chainId.length +
      requestId.length +
      queryRequestLength.length +
      queryRequest.length +
      numResponses.length +
      perChainQueryResponse.length,
  );

  queryResponse.set(version, 0); // version (1 byte)
  queryResponse.set(chainId, 1); // chain id (2 bytes)
  queryResponse.set(requestId, 3); // request id (32 bytes in this case)
  queryResponse.set(queryRequestLength, 35); // queryRequest length (4 bytes) 
  queryResponse.set(queryRequest, 39); // queryRequest
  queryResponse.set(numResponses, 39 + queryRequest.length); // number of responses (1 byte)
  queryResponse.set(perChainQueryResponse, 39 + queryRequest.length + 1); // first responses

  return queryResponse;
}
