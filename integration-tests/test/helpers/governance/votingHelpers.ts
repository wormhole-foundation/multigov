import type { Address } from 'viem';
import { HubGovernorAbi, SpokeVoteAggregatorAbi } from '../../../abis';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';
import type { VoteType } from '../../config/types';

export const voteOnProposal = async ({
  isHub,
  proposalId,
  voteType,
}: {
  isHub: boolean;
  proposalId: bigint;
  voteType: VoteType;
}) => {
  const { ethWallet, eth2Wallet, account } = createClients();
  const wallet = isHub ? ethWallet : eth2Wallet;
  const contractAddress = isHub
    ? ContractAddresses.HUB_GOVERNOR
    : ContractAddresses.SPOKE_VOTE_AGGREGATOR;

  const abi = isHub ? HubGovernorAbi : SpokeVoteAggregatorAbi;
  const chain = isHub ? ethWallet.chain : eth2Wallet.chain;

  const hash = await wallet.writeContract({
    address: contractAddress,
    abi,
    functionName: 'castVote',
    args: [proposalId, voteType],
    account,
    chain,
  });
  console.log(
    `Voted on proposal ${proposalId} on chain ${chain.name}. Support: ${voteType}. Transaction hash: ${hash}`,
  );
  return hash;
};

export const getVotingPower = async ({
  account,
  isHub,
  timestamp,
}: {
  account: Address;
  isHub: boolean;
  timestamp: bigint;
}) => {
  const { ethClient, eth2Client } = createClients();
  console.log(
    `Getting voting weight for ${account} at timestamp ${timestamp} on ${
      isHub ? 'hub' : 'spoke'
    }`,
  );

  const client = isHub ? ethClient : eth2Client;

  if (isHub) {
    const result = await client.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'getVotes',
      args: [account, timestamp],
    });
    return result;
  }
  const result = await client.readContract({
    address: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    abi: SpokeVoteAggregatorAbi,
    functionName: 'getVotes',
    args: [account, timestamp],
  });

  return result;
};

export const getVoteWeightWindow = async ({
  isHub,
  timestamp,
}: {
  isHub: boolean;
  timestamp: bigint;
}) => {
  const { ethClient, eth2Client } = createClients();
  const client = isHub ? ethClient : eth2Client;

  if (isHub) {
    return await client.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'getVoteWeightWindowLength',
      args: [timestamp],
    });
  }

  return await client.readContract({
    address: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    abi: SpokeVoteAggregatorAbi,
    functionName: 'getVoteWeightWindowLength',
    args: [timestamp],
  });
};

export const getProposalVotes = async ({
  proposalId,
  isHub,
}: {
  proposalId: bigint;
  isHub: boolean;
}): Promise<{
  againstVotes: bigint;
  forVotes: bigint;
  abstainVotes: bigint;
}> => {
  const { ethClient, eth2Client } = createClients();
  const client = isHub ? ethClient : eth2Client;

  const votes = await client.readContract({
    address: isHub
      ? ContractAddresses.HUB_GOVERNOR
      : ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    abi: isHub ? HubGovernorAbi : SpokeVoteAggregatorAbi,
    functionName: 'proposalVotes',
    args: [proposalId],
  });

  // The first element is the proposalId when getting from the SpokeVoteAggregator, so againstVotes is the second element
  // Vote length of 3 is the hub
  if (votes.length === 3) {
    return {
      againstVotes: votes[0],
      forVotes: votes[1],
      abstainVotes: votes[2],
    };
  }

  return {
    againstVotes: votes[1],
    forVotes: votes[2],
    abstainVotes: votes[3],
  };
};
