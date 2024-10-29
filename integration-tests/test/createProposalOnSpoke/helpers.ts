import {
  type EthCallData,
  EthCallWithFinalityQueryRequest,
  PerChainQueryRequest,
  QueryRequest,
  sign,
} from '@wormhole-foundation/wormhole-query-sdk';
import { SpokeMetadataCollectorAbi } from 'abis';
import HubProposalMetadataAbi from 'abis/HubProposalMetadataAbi';
import { ContractAddresses } from 'test/config/addresses';
import { ETH_DEVNET_WORMHOLE_CHAIN_ID } from 'test/config/chains';
import { createClients } from 'test/config/clients';
import { getPrivateKeyHex } from 'test/config/mainAccount';
import {
  createArbitraryProposalData,
  createProposalViaAggregateProposer,
  sendQueryToWormhole,
} from 'test/helpers';
import type { WormholeQueryResponse } from 'test/helpers/wormhole/types';
import { encodeFunctionData } from 'viem';

export const createProposalOnSpoke = async () => {
  // 1. Create proposal on hub via aggregate proposer
  const proposalData = await createArbitraryProposalData();
  const proposalId = await createProposalViaAggregateProposer({ proposalData });

  // 2. Get Wormhole query response containing proposal metadata
  const { ethClient } = createClients();
  const currentBlock = await ethClient.getBlock();
  const queryResponse = await getWormholeAddProposalQueryResponse({
    proposalId,
    proposalCreatedBlock: currentBlock.number,
  });

  // 3. Add proposal to spoke using the queried metadata
  await addProposalToSpoke(queryResponse);

  return proposalId;
};

const getWormholeAddProposalQueryResponse = async ({
  proposalId,
  proposalCreatedBlock,
}: {
  proposalId: bigint;
  proposalCreatedBlock: bigint;
}): Promise<WormholeQueryResponse> => {
  const blockNumberHex = `0x${proposalCreatedBlock.toString(16)}`;

  const hubProposalMetadataCall: EthCallData = {
    to: ContractAddresses.HUB_PROPOSAL_METADATA,
    data: encodeFunctionData({
      abi: HubProposalMetadataAbi,
      functionName: 'getProposalMetadata',
      args: [proposalId],
    }),
  };

  const hubQuery = new EthCallWithFinalityQueryRequest(
    blockNumberHex,
    'finalized',
    [hubProposalMetadataCall],
  );

  const hubChainQuery = new PerChainQueryRequest(
    ETH_DEVNET_WORMHOLE_CHAIN_ID,
    hubQuery,
  );
  const request = new QueryRequest(1, [hubChainQuery]);
  const serialized = request.serialize();
  const signature = sign(
    getPrivateKeyHex().slice(2),
    QueryRequest.digest('DEVNET', serialized),
  );

  return await sendQueryToWormhole({
    serialized,
    signature,
  });
};

export const addProposalToSpoke = async (
  queryResponse: WormholeQueryResponse,
) => {
  const { eth2Client, eth2Wallet } = createClients();

  const hash = await eth2Wallet.writeContract({
    address: ContractAddresses.SPOKE_METADATA_COLLECTOR,
    abi: SpokeMetadataCollectorAbi,
    functionName: 'addProposal',
    args: [
      queryResponse.queryResponseBytes,
      queryResponse.queryResponseSignatures,
    ],
  });

  await eth2Client.waitForTransactionReceipt({ hash });
};

export const getProposalOnSpoke = async (proposalId: bigint) => {
  const { eth2Client } = createClients();

  return await eth2Client.readContract({
    address: ContractAddresses.SPOKE_METADATA_COLLECTOR,
    abi: SpokeMetadataCollectorAbi,
    functionName: 'getProposal',
    args: [proposalId],
  });
};
