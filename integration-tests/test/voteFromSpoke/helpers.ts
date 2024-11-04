import {
  type EthCallData,
  EthCallWithFinalityQueryRequest,
  PerChainQueryRequest,
  QueryRequest,
  sign,
} from '@wormhole-foundation/wormhole-query-sdk';
import { HubVotePoolAbi, SpokeVoteAggregatorAbi } from 'abis';
import { ContractAddresses } from 'test/config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from 'test/config/chains';
import { createClients } from 'test/config/clients';
import { DEFAULT_PRIVATE_KEY } from 'test/config/mainAccount';
import { VoteType } from 'test/config/types';
import { sendQueryToWormhole } from 'test/helpers/wormhole/wormholeHelpers';
import { encodeFunctionData } from 'viem';

// Votes on the spoke via the `SpokeVoteAggregator` contract and bridges the votes to the hub
export const voteFromSpoke = async (proposalId: bigint) => {
  const votedAtBlock = await voteOnSpoke(proposalId);
  await bridgeVotesToHub(proposalId, votedAtBlock);
};

// Votes on the spoke via the `SpokeVoteAggregator` contract
export const voteOnSpoke = async (proposalId: bigint) => {
  const { eth2Client, eth2Wallet, account } = createClients();

  await eth2Client.simulateContract({
    address: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    abi: SpokeVoteAggregatorAbi,
    functionName: 'castVote',
    args: [proposalId, VoteType.FOR],
    account,
  });

  const hash = await eth2Wallet.writeContract({
    address: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    abi: SpokeVoteAggregatorAbi,
    functionName: 'castVote',
    args: [proposalId, VoteType.FOR],
    account,
  });

  const receipt = await eth2Client.waitForTransactionReceipt({ hash });

  console.log('voted on spoke');

  return receipt.blockNumber;
};

export const bridgeVotesToHub = async (
  proposalId: bigint,
  votedAtBlock: bigint,
) => {
  const { ethClient, ethWallet, account } = createClients();

  const { queryResponseBytes, queryResponseSignatures } =
    await getWormholeProposalVotesQueryResponse({
      proposalId,
      votedAtBlock,
    });

  // Submit the spoke votes to the hub vote pool
  await ethClient.simulateContract({
    address: ContractAddresses.HUB_VOTE_POOL,
    abi: HubVotePoolAbi,
    functionName: 'crossChainVote',
    args: [queryResponseBytes, queryResponseSignatures],
    account,
  });

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_VOTE_POOL,
    abi: HubVotePoolAbi,
    functionName: 'crossChainVote',
    args: [queryResponseBytes, queryResponseSignatures],
    account,
  });

  await ethClient.waitForTransactionReceipt({ hash });

  console.log('bridged votes to hub');
};

export const getWormholeProposalVotesQueryResponse = async ({
  proposalId,
  votedAtBlock,
}: {
  proposalId: bigint;
  votedAtBlock: bigint;
}) => {
  const blockNumberHex = `0x${votedAtBlock.toString(16)}`;

  const spokeProposalVotesCall: EthCallData = {
    to: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    data: encodeFunctionData({
      abi: SpokeVoteAggregatorAbi,
      functionName: 'proposalVotes',
      args: [proposalId],
    }),
  };

  const spokeQuery = new EthCallWithFinalityQueryRequest(
    blockNumberHex,
    'finalized',
    [spokeProposalVotesCall],
  );

  const spokeChainQuery = new PerChainQueryRequest(
    ETH2_DEVNET_WORMHOLE_CHAIN_ID,
    spokeQuery,
  );

  const nonce = 1;
  const request = new QueryRequest(nonce, [spokeChainQuery]);

  // Serialize the request
  const serialized = request.serialize();

  const privateKeyStr = DEFAULT_PRIVATE_KEY.slice(2);

  // Sign the request
  const signature = sign(
    privateKeyStr,
    QueryRequest.digest('DEVNET', serialized),
  );

  return await sendQueryToWormhole({
    serialized,
    signature,
  });
};
