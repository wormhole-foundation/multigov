import type { Address } from 'viem';
import {
  HubGovernorAbi,
  SpokeMetadataCollectorAbi,
  SpokeVoteAggregatorAbi,
} from '../../../abis';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';
import { VoteType } from '../../config/types';

export const voteOnProposal = async ({
  isHub,
  proposalId,
  voteType,
}: {
  isHub: boolean;
  proposalId: bigint;
  voteType: VoteType;
}) => {
  const { ethClient, ethWallet, eth2Client, eth2Wallet, account } =
    createClients();
  const wallet = isHub ? ethWallet : eth2Wallet;
  const client = isHub ? ethClient : eth2Client;
  const contractAddress = isHub
    ? ContractAddresses.HUB_GOVERNOR
    : ContractAddresses.SPOKE_VOTE_AGGREGATOR;

  const abi = isHub ? HubGovernorAbi : SpokeVoteAggregatorAbi;
  const chain = isHub ? ethWallet.chain : eth2Wallet.chain;

  // Cast vote
  const hash = await wallet.writeContract({
    address: contractAddress,
    abi,
    functionName: 'castVote',
    args: [proposalId, voteType],
    account,
    chain,
  });

  // Wait for transaction to be mined
  await client.waitForTransactionReceipt({ hash });
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

// Get the vote start for a proposal on the hub or spoke
export const getVoteStart = async ({
  proposalId,
  isHub,
}: {
  proposalId: bigint;
  isHub: boolean;
}) => {
  const { ethClient, eth2Client } = createClients();
  if (isHub) {
    return await ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalSnapshot',
      args: [proposalId],
    });
  }
  const { voteStart } = await eth2Client.readContract({
    address: ContractAddresses.SPOKE_METADATA_COLLECTOR,
    abi: SpokeMetadataCollectorAbi,
    functionName: 'getProposal',
    args: [proposalId],
  });
  return voteStart;
};

// Get the vote end for a proposal on the hub
export const getVoteEnd = async ({ proposalId }: { proposalId: bigint }) => {
  const { ethClient } = createClients();
  return await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalDeadline',
    args: [proposalId],
  });
};
