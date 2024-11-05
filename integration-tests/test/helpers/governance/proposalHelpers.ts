import { encodeFunctionData, keccak256, parseEther, toBytes } from 'viem';
import { HubEvmSpokeAggregateProposerAbi, HubGovernorAbi } from '../../../abis';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';
import { VoteType } from '../../config/types';
import { mineToTimestamp } from '../time/timeHelpers';
import { handleNoAccount } from '../wallet/walletHelpers';
import { getWormholeGetVotesQueryResponse } from '../wormhole/wormholeHelpers';
import type { ProposalData, ProposalInfo } from './types';
import { getVoteEnd, getVoteStart, voteOnProposal } from './votingHelpers';

// Core proposal creation functions
export const createProposalViaAggregateProposer = async ({
  proposalData,
}: {
  proposalData: ProposalData;
}) => {
  const { ethClient, ethWallet, account } = createClients();
  const timestamp = (await ethClient.getBlock()).timestamp - 300n; // 5 minutes ago

  const { queryResponseBytes, queryResponseSignatures } =
    await getWormholeGetVotesQueryResponse({
      account: account.address,
      timestampSpoke: timestamp,
    });

  const { result: proposalId } = await ethClient.simulateContract({
    address: ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    abi: HubEvmSpokeAggregateProposerAbi,
    functionName: 'checkAndProposeIfEligible',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      proposalData.description,
      queryResponseBytes,
      queryResponseSignatures,
    ],
    account,
  });

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    abi: HubEvmSpokeAggregateProposerAbi,
    functionName: 'checkAndProposeIfEligible',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      proposalData.description,
      queryResponseBytes,
      queryResponseSignatures,
    ],
    account,
    chain: ethWallet.chain,
  });

  await ethWallet.waitForTransactionReceipt({ hash });
  return proposalId;
};

export const createProposalViaHubGovernor = async (
  proposalData: ProposalData,
) => {
  const { ethClient, ethWallet } = createClients();
  const account = handleNoAccount(ethWallet);

  const { result: proposalId } = await ethClient.simulateContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'propose',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      proposalData.description,
    ],
    account,
  });

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'propose',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      proposalData.description,
    ],
    account,
    chain: ethWallet.chain,
  });

  await ethClient.waitForTransactionReceipt({ hash });
  return proposalId;
};

// Proposal lifecycle management
export const passProposal = async ({
  proposalId,
  proposalData,
}: {
  proposalId: bigint;
  proposalData: ProposalData;
}) => {
  const { ethClient } = createClients();

  const voteStart = await getVoteStart({ proposalId });

  await mineToTimestamp({ client: ethClient, timestamp: voteStart });
  await voteOnProposal({ proposalId, isHub: true, voteType: VoteType.FOR });

  const voteEnd = await getVoteEnd({ proposalId });
  await mineToTimestamp({ client: ethClient, timestamp: voteEnd + 1n });

  const finalState = await getProposal(proposalId);
  if (finalState.state === 3) {
    throw new Error('Proposal was defeated');
  }

  if (await needsQueue(proposalId)) {
    await queueProposal({ proposalId, proposalData });
  }
};

// Proposal utilities
export const createProposalData = ({
  targets,
  values,
  calldatas,
  description,
}: ProposalData): ProposalData => ({
  targets,
  values,
  calldatas,
  description,
});

export const getProposal = async (
  proposalId: bigint,
): Promise<ProposalInfo> => {
  const { ethClient } = createClients();

  const [state, votes, snapshot, deadline, proposer, eta] = await Promise.all([
    ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'state',
      args: [proposalId],
    }),
    ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalVotes',
      args: [proposalId],
    }),
    ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalSnapshot',
      args: [proposalId],
    }),
    ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalDeadline',
      args: [proposalId],
    }),
    ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalProposer',
      args: [proposalId],
    }),
    ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalEta',
      args: [proposalId],
    }),
  ]);

  return {
    id: proposalId,
    state,
    votes: {
      againstVotes: votes[0],
      forVotes: votes[1],
      abstainVotes: votes[2],
    },
    snapshot,
    deadline,
    proposer,
    eta,
  };
};

// Helper functions
const needsQueue = async (proposalId: bigint): Promise<boolean> => {
  const { ethClient } = createClients();
  return ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalNeedsQueuing',
    args: [proposalId],
  });
};

const queueProposal = async ({
  proposalId,
  proposalData,
}: {
  proposalId: bigint;
  proposalData: ProposalData;
}) => {
  const { ethClient, ethWallet } = createClients();
  const descriptionHash = keccak256(toBytes(proposalData.description));

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'queue',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      descriptionHash,
    ],
    account: handleNoAccount(ethWallet),
    chain: ethWallet.chain,
  });

  await ethClient.waitForTransactionReceipt({ hash });

  const eta = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalEta',
    args: [proposalId],
  });

  await mineToTimestamp({ client: ethClient, timestamp: eta + 1n });
};

export const createAndExecuteProposalViaHubGovernor = async (
  proposalData: ProposalData,
) => {
  // Create proposal
  const proposalId = await createProposalViaHubGovernor(proposalData);

  // Pass proposal (vote, queue if needed)
  await passProposal({ proposalId, proposalData });

  // Execute proposal
  await executeProposal({ proposalData });

  return proposalId;
};

export const executeProposal = async ({
  proposalData,
}: {
  proposalData: ProposalData;
}) => {
  const { ethClient, ethWallet } = createClients();
  const descriptionHash = keccak256(toBytes(proposalData.description));

  // impersonate timelock
  await ethClient.setBalance({
    address: ContractAddresses.TIMELOCK_CONTROLLER,
    value: parseEther('1'),
  });

  await ethClient.impersonateAccount({
    address: ContractAddresses.TIMELOCK_CONTROLLER,
  });

  await ethClient.simulateContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'execute',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      descriptionHash,
    ],
    account: ContractAddresses.TIMELOCK_CONTROLLER,
  });

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'execute',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      descriptionHash,
    ],
    account: ContractAddresses.TIMELOCK_CONTROLLER,
  });

  await ethClient.stopImpersonatingAccount({
    address: ContractAddresses.TIMELOCK_CONTROLLER,
  });

  await ethClient.waitForTransactionReceipt({ hash });
};

export const createArbitraryProposalData = async () => {
  const { ethClient } = createClients();

  // Get current timestamp for unique description
  const timestamp = (await ethClient.getBlock()).timestamp;
  const nonce = Math.floor(Math.random() * 1000000);

  // Get current quorum and decrease it by 1
  const quorum = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'quorum',
    args: [timestamp],
  });
  const newQuorum = quorum - 1n;

  return createProposalData({
    targets: [ContractAddresses.HUB_GOVERNOR],
    values: [0n],
    calldatas: [
      encodeFunctionData({
        abi: HubGovernorAbi,
        functionName: 'setQuorum',
        args: [newQuorum],
      }),
    ],
    description: `Arbitrary proposal to set quorum to ${newQuorum} at timestamp ${timestamp} (nonce: ${nonce})`,
  });
};

export const waitForProposalToBeActive = async (proposalId: bigint) => {
  const { ethClient } = createClients();
  const voteStart = await getVoteStart({ proposalId });
  await mineToTimestamp({ client: ethClient, timestamp: voteStart });
};
