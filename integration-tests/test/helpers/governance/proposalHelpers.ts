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
  console.log('Creating proposal via aggregate proposer...');
  const { ethClient, ethWallet, account } = createClients();
  const timestamp = (await ethClient.getBlock()).timestamp - 300n; // 5 minutes ago

  // Pass block timestamp - the Wormhole query will handle microsecond conversion
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
  console.log('✅ Proposal created via aggregate proposer');
  return proposalId;
};

export const createProposalViaHubGovernor = async (
  proposalData: ProposalData,
) => {
  console.log('Creating proposal via hub governor...');
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
  console.log('✅ Proposal created via hub governor');
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

  const voteStart = await getVoteStart({ proposalId, isHub: true });

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
  console.log('Creating and executing proposal via hub governor...');
  // Create proposal
  const proposalId = await createProposalViaHubGovernor(proposalData);

  // Pass proposal (vote, queue if needed)
  await passProposal({ proposalId, proposalData });

  // Execute proposal
  await executeProposal({ proposalData });

  console.log('✅ Proposal created and executed');
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
  console.log('Waiting for proposal to be active...');
  const { ethClient, eth2Client } = createClients();

  const currentTimestampHub = (await ethClient.getBlock()).timestamp;
  const currentTimestampSpoke = (await eth2Client.getBlock()).timestamp;

  const voteStartHub = await getVoteStart({ proposalId, isHub: true });
  const voteStartSpoke = await getVoteStart({ proposalId, isHub: false });

  const timestampToUse =
    BigInt(
      Math.max(
        Number(voteStartHub),
        Number(voteStartSpoke),
        Number(currentTimestampHub),
        Number(currentTimestampSpoke),
      ),
    ) + 1n;

  await mineToTimestamp({ client: ethClient, timestamp: timestampToUse });
  await mineToTimestamp({ client: eth2Client, timestamp: timestampToUse });

  console.log('✅ Proposal is active');
};

// Creates and executes a proposal via the HubGovernor directly
export async function createAndExecuteProposal(proposalData: ProposalData) {
  const { ethClient, ethWallet } = createClients();

  console.log('Creating proposal...');
  const proposalId = await createProposalViaHubGovernor({
    targets: proposalData.targets,
    values: proposalData.values,
    calldatas: proposalData.calldatas,
    description: proposalData.description,
  });
  console.log('Created proposal:', proposalId);

  // Get and log current state
  const state = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'state',
    args: [proposalId],
  });
  console.log('Initial proposal state:', state);

  console.log('Passing proposal...');
  await passProposal({
    proposalId,
    proposalData,
  });

  // Get and log state after voting
  const stateAfterVoting = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'state',
    args: [proposalId],
  });
  console.log('State after voting:', stateAfterVoting);

  console.log('Executing proposal...');
  await executeProposal({
    wallet: ethWallet,
    proposalId,
    proposalData,
  });

  return proposalId;
}

export const createProposalViaHubGovernor = async ({
  targets,
  values,
  calldatas,
  description,
}: ProposalData) => {
  const { ethClient, ethWallet } = createClients();

  // First simulate to get the proposal ID
  const { result: proposalId } = await ethClient.simulateContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'propose',
    args: [targets, values, calldatas, description],
    account: handleNoAccount(ethWallet),
  });

  // Send the transaction
  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'propose',
    args: [targets, values, calldatas, description],
    account: handleNoAccount(ethWallet),
    chain: ethWallet.chain,
  });

  // Wait for transaction to be mined
  const receipt = await ethClient.waitForTransactionReceipt({ hash });
  console.log(`Created proposal ${proposalId}. Transaction receipt:`, receipt);

  // Verify proposal exists
  const state = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'state',
    args: [proposalId],
  });
  console.log('Initial proposal state:', state);

  return proposalId;
};

// Go through the proposal state flow to make it pass
export const passProposal = async ({
  proposalId,
  proposalData,
}: { proposalId: bigint; proposalData: ProposalData }) => {
  const { ethClient, ethWallet } = createClients();

  // Get initial proposal state
  const initialProposal = await getProposal(proposalId);
  console.log('Initial proposal state:', initialProposal);

  const voteStart = await getVoteStart({ proposalId });
  console.log('Vote start timestamp:', voteStart);

  if (voteStart === 0n) {
    throw new Error('Vote start timestamp is 0');
  }

  await mineToTimestamp({ client: ethClient, timestamp: voteStart });

  // Check quorum before voting
  const quorum = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'quorum',
    args: [voteStart],
  });
  console.log('Quorum required:', quorum);

  // Vote with enough power to pass
  await voteOnProposal({
    proposalId,
    isHub: true,
    voteType: VoteType.FOR,
  });

  const voteEnd = await getVoteEnd({ proposalId });
  console.log('Vote end timestamp:', voteEnd);

  if (voteEnd === 0n) {
    throw new Error('Vote end timestamp is 0');
  }

  await mineToTimestamp({ client: ethClient, timestamp: voteEnd + 1n });

  // Check state after voting
  const state = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'state',
    args: [proposalId],
  });
  console.log('State after voting:', state);

  // Get final proposal state
  const finalProposal = await getProposal(proposalId);
  console.log('Final proposal state:', finalProposal);

  if (finalProposal.state === 3) {
    // Defeated
    throw new Error('Proposal was defeated. Check quorum and voting power.');
  }

  // Queue the proposal if needed
  const needsQueue = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalNeedsQueuing',
    args: [proposalId],
  });

  if (needsQueue) {
    console.log('Queueing proposal...');
    const hash = await ethWallet.writeContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'queue',
      args: [
        proposalData.targets,
        proposalData.values,
        proposalData.calldatas,
        keccak256(toBytes(proposalData.description)),
      ],
      account: handleNoAccount(ethWallet),
      chain: ethWallet.chain,
    });
    console.log('Queued proposal. Transaction hash:', hash);

    await ethClient.waitForTransactionReceipt({ hash });

    // Wait for timelock delay
    const eta = await ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalEta',
      args: [proposalId],
    });

    await mineToTimestamp({ client: ethClient, timestamp: eta + 1n });
  }
};

export const getProposal = async (proposalId: bigint) => {
  const { ethClient } = createClients();

  // Get proposal state
  const state = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'state',
    args: [proposalId],
  });

  // Get proposal votes
  const votes = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalVotes',
    args: [proposalId],
  });

  // Get proposal snapshot and deadline
  const snapshot = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalSnapshot',
    args: [proposalId],
  });

  const deadline = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalDeadline',
    args: [proposalId],
  });

  // Get proposer
  const proposer = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalProposer',
    args: [proposalId],
  });

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
    eta: await ethClient.readContract({
      address: ContractAddresses.HUB_GOVERNOR,
      abi: HubGovernorAbi,
      functionName: 'proposalEta',
      args: [proposalId],
    }),
  };
};
