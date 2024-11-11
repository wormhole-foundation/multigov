import { type NativeAddress, toNative } from '@wormhole-foundation/sdk';
import {
  EthCallByTimestampQueryRequest,
  type EthCallData,
  PerChainQueryRequest,
  QueryRequest,
  sign,
} from '@wormhole-foundation/wormhole-query-sdk';
import { type Address, encodeFunctionData } from 'viem';
import { HubEvmSpokeAggregateProposerAbi } from '../../../abis';
import { SpokeVoteAggregatorAbi } from '../../../abis';
import { QUERY_URL } from '../../config';
import { ContractAddresses } from '../../config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from '../../config/chains';
import { createClients } from '../../config/clients';
import { getPrivateKeyHex } from '../../config/mainAccount';
import type { QueryRes } from './types';

/**
 * Converts an EVM address to Wormhole's bytes32 format
 * @param address The EVM address to convert
 * @returns The address as bytes32, right-padded with zeros
 */
export const toWormholeFormat = (address: Address): `0x${string}` => {
  const ethAddress: NativeAddress<'Ethereum'> = toNative('Ethereum', address);
  return ethAddress.toUniversalAddress().toString() as `0x${string}`;
};

export const guardiansCertifyWormholeQuery = async ({
  serialized,
}: {
  signature: string;
  serialized: Uint8Array;
}) => {
  if (!process.env.WORMHOLE_API_KEY) {
    throw new Error('WORMHOLE_API_KEY is not set');
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `Sending query to Wormhole (attempt ${attempt + 1}/${maxRetries})...`,
      );
      const response = await fetch(QUERY_URL, {
        method: 'PUT',
        body: JSON.stringify({
          bytes: Buffer.from(serialized).toString('hex'),
        }),
        headers: {
          'X-API-Key': process.env.WORMHOLE_API_KEY,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as QueryRes;
        console.log('Query successful!');

        const queryResponseBytes = `0x${data.bytes}` as `0x${string}`;
        const queryResponseSignatures = formatQueryResponseSignaturesForViem(
          data.signatures,
        );

        return {
          queryResponseBytes,
          queryResponseSignatures,
        };
      }

      console.log(`Query failed with status ${response.status}, retrying...`);
    } catch (error) {
      console.log(`Query failed with error: ${error}, retrying...`);
    }

    attempt++;
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay between retries
    }
  }

  throw new Error('Failed to query Wormhole after all retries');
};

export const getWormholeGetVotesQueryResponse = async ({
  account,
  timestampSpoke,
}: {
  account: Address;
  timestampSpoke: bigint;
}) => {
  const spokeChainId = ETH2_DEVNET_WORMHOLE_CHAIN_ID;

  const spokeVoteAggregatorCall: EthCallData = {
    to: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    data: encodeFunctionData({
      abi: SpokeVoteAggregatorAbi,
      functionName: 'getVotes',
      args: [account, timestampSpoke],
    }),
  };

  // Convert to microseconds
  const timestampUsSpoke = timestampSpoke * 1_000_000n;

  // Create EthCallByTimestampQueryRequest for each chain
  const spokeQuery = new EthCallByTimestampQueryRequest(
    timestampUsSpoke,
    '',
    '',
    [spokeVoteAggregatorCall],
  );

  // Create PerChainQueryRequest for each chain
  const spokeChainQuery = new PerChainQueryRequest(spokeChainId, spokeQuery);

  // Create the final QueryRequest
  const nonce = 1; // Might want to generate this dynamically
  const request = new QueryRequest(nonce, [spokeChainQuery]);

  // Serialize the request
  const serialized = request.serialize();

  const privateKeyStr = getPrivateKeyHex().slice(2);

  // Sign the request
  const signature = sign(
    privateKeyStr,
    QueryRequest.digest('DEVNET', serialized),
  );

  const { queryResponseBytes, queryResponseSignatures } =
    await guardiansCertifyWormholeQuery({
      serialized,
      signature,
    });

  return {
    queryResponseBytes,
    queryResponseSignatures,
  };
};

export const formatQueryResponseSignaturesForViem = (signatures: string[]) => {
  return signatures.map((s) => ({
    r: `0x${s.substring(0, 64)}` as `0x${string}`,
    s: `0x${s.substring(64, 128)}` as `0x${string}`,
    v: Number.parseInt(s.substring(128, 130), 16) + 27,
    guardianIndex: Number.parseInt(s.substring(130, 132), 16),
  }));
};

export const getMaxQueryTimestampOffset = async () => {
  const { ethClient } = createClients();
  return await ethClient.readContract({
    address: ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    abi: HubEvmSpokeAggregateProposerAbi,
    functionName: 'maxQueryTimestampOffset',
  });
};
