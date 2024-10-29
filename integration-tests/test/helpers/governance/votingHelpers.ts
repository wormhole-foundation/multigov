import type { Address } from 'viem';
import { HubGovernorAbi, SpokeVoteAggregatorAbi } from '../../../abis';
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

  // Get voting power before voting
  const snapshot = await getVoteStart({ proposalId });
  const votingPower = await getVotingPower({
    account: account.address,
    isHub,
    timestamp: snapshot,
  });
  console.log(`Voting power before voting: ${votingPower}`);

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

  // Verify vote was counted
  const votes = await client.readContract({
    address: contractAddress,
    abi,
    functionName: 'proposalVotes',
    args: [proposalId],
  });
  console.log('Votes after casting:', votes);

  // Verify our vote was counted correctly
  const expectedVotes = {
    againstVotes: voteType === VoteType.AGAINST ? votingPower : 0n,
    forVotes: voteType === VoteType.FOR ? votingPower : 0n,
    abstainVotes: voteType === VoteType.ABSTAIN ? votingPower : 0n,
  };
  console.log('Expected votes:', expectedVotes);

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

export const getVoteStart = async ({ proposalId }: { proposalId: bigint }) => {
  const { ethClient } = createClients();

  return await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalSnapshot',
    args: [proposalId],
  });
};

export const getVoteEnd = async ({ proposalId }: { proposalId: bigint }) => {
  const { ethClient } = createClients();
  return await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalDeadline',
    args: [proposalId],
  });
};
