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
import { getPrivateKeyHex } from 'test/config/mainAccount';
import { VoteType } from 'test/config/types';
import { getVoteStart } from 'test/helpers';
import { sendQueryToWormhole } from 'test/helpers/wormhole/wormholeHelpers';
import { encodeFunctionData } from 'viem';
import { mineToTimestamp } from '../helpers/time/timeHelpers';

// Votes on the spoke via the `SpokeVoteAggregator` contract and bridges the votes to the hub
export const voteFromSpoke = async (proposalId: bigint) => {
  console.log('Voting from spoke...');
  await waitForProposalActive(proposalId);
  const votedAtBlock = await voteOnSpoke(proposalId);
  await bridgeVotesToHub(proposalId, votedAtBlock);
  console.log('Voting from spoke completed');
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
  console.log('Getting wormhole proposal votes query response...');
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

  const privateKeyStr = getPrivateKeyHex().slice(2);

  // Sign the request
  const signature = sign(
    privateKeyStr,
    QueryRequest.digest('DEVNET', serialized),
  );

  console.log('Sending query to wormhole...');
  return await sendQueryToWormhole({
    serialized,
    signature,
  });
};

export const waitForProposalActive = async (proposalId: bigint) => {
  console.log('\nWaiting for proposal to be active...');
  const { ethClient, eth2Client } = createClients();

  // Get vote start from both chains
  const [hubVoteStart, spokeVoteStart] = await Promise.all([
    getVoteStart({ proposalId, isHub: true }),
    getVoteStart({ proposalId, isHub: false }),
  ]);

  // Get current timestamps
  const [hubBlock, spokeBlock] = await Promise.all([
    ethClient.getBlock(),
    eth2Client.getBlock(),
  ]);

  // Use the latest timestamp of all values
  const voteStart = BigInt(
    Math.max(
      Number(hubVoteStart),
      Number(spokeVoteStart),
      Number(hubBlock.timestamp),
      Number(spokeBlock.timestamp),
    ) + 1, // Add 1 to ensure we're moving forward
  );

  console.log('Vote start:', voteStart);
  console.log('Current hub timestamp:', hubBlock.timestamp);
  console.log('Current spoke timestamp:', spokeBlock.timestamp);

  // Move both chains forward sequentially
  await mineToTimestamp({ client: ethClient, timestamp: voteStart });
  await mineToTimestamp({ client: eth2Client, timestamp: voteStart });

  console.log('✅ Proposal is active');
};
