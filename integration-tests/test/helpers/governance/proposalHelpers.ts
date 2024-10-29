import { VoteType, type Wallet } from 'test/config/types';
import {
  type WalletClient,
  encodeFunctionData,
  keccak256,
  toBytes,
} from 'viem';
import { HubEvmSpokeAggregateProposerAbi, HubGovernorAbi } from '../../../abis';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';
import { mineToTimestamp } from '../time/timeHelpers';
import {
  getMaxQueryTimestampOffset,
  getWormholeGetVotesQueryResponse,
} from '../wormhole/wormholeHelpers';
import type { ProposalData } from './types';
import {
  getVoteEnd,
  getVoteStart,
  getVotingPower,
  voteOnProposal,
} from './votingHelpers';

export function createProposalData({
  targets,
  values,
  calldatas,
  description,
}: ProposalData) {
  return {
    targets,
    values,
    calldatas,
    description,
  };
}

export const createProposalViaAggregateProposer = async ({
  proposalData,
}: {
  proposalData: ProposalData;
}) => {
  const { ethClient, eth2Client, ethWallet, account } = createClients();

  // Get current block timestamps
  const hubBlock = await ethClient.getBlock();
  const spokeBlock = await eth2Client.getBlock();
  const maxQueryTimestampOffset = await getMaxQueryTimestampOffset();

  // Use timestamp from 5 minutes ago for query server compatibility
  const FIVE_MINUTES = 300n;
  const timestamp = hubBlock.timestamp - FIVE_MINUTES;

  // Verify we're still within maxQueryTimestampOffset
  if (hubBlock.timestamp - timestamp > BigInt(maxQueryTimestampOffset)) {
    throw new Error('Timestamp too old for maxQueryTimestampOffset');
  }

  console.log('Timestamps after sync:', {
    hubBlock: Number(hubBlock.timestamp),
    spokeBlock: Number(spokeBlock.timestamp),
    queryTimestamp: Number(timestamp),
    maxOffset: maxQueryTimestampOffset,
    offsetFromCurrent: Number(hubBlock.timestamp - timestamp),
  });

  // Debug: Check voting power using block timestamp
  const hubVotingPower = await getVotingPower({
    account: account.address,
    isHub: true,
    timestamp,
  });
  const spokeVotingPower = await getVotingPower({
    account: account.address,
    isHub: false,
    timestamp,
  });
  console.log(`Hub voting power: ${hubVotingPower}`);
  console.log(`Spoke voting power: ${spokeVotingPower}`);

  // Pass block timestamp - the Wormhole query will handle microsecond conversion
  const { queryResponseBytes, queryResponseSignatures } =
    await getWormholeGetVotesQueryResponse({
      account: account.address,
      timestampSpoke: timestamp,
    });

  console.log('Query response bytes:', queryResponseBytes);
  console.log('Query response signatures:', queryResponseSignatures);
  console.log('🦄 ~ account:', account.address);

  try {
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

    console.log(`Created proposal. Transaction hash: ${hash}`);

    await ethWallet.waitForTransactionReceipt({ hash });

    return proposalId;
  } catch (error) {
    console.error('Error creating proposal:', error);
    throw error;
  }
};

export const executeProposal = async ({
  wallet,
  proposalId,
  proposalData,
}: {
  wallet: Wallet;
  proposalId: bigint;
  proposalData: ProposalData;
}) => {
  const descriptionHash = keccak256(toBytes(proposalData.description));

  await wallet.simulateContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'execute',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      descriptionHash,
    ],
  });

  const hash = await wallet.writeContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'execute',
    args: [
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas,
      descriptionHash,
    ],
    account: handleNoAccount(wallet),
    chain: wallet.chain,
  });

  console.log(`Executed proposal ${proposalId}. Transaction hash: ${hash}`);
  return proposalId;
};

export const createArbitraryProposalData = async () => {
  const { ethClient } = createClients();

  const timestamp = (await ethClient.getBlock()).timestamp;
  const nonce = Math.floor(Math.random() * 1000000);
  const quorum = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'quorum',
    args: [timestamp],
  });
  const newQuorum = quorum - 1n;

  return {
    targets: [ContractAddresses.HUB_GOVERNOR],
    values: [0n],
    calldatas: [
      encodeFunctionData({
        abi: HubGovernorAbi,
        functionName: 'setQuorum',
        args: [newQuorum],
      }),
    ],
    description: `Arbitrary proposal to set quorum to ${newQuorum} (nonce: ${nonce})`,
  };
};

const handleNoAccount = (wallet: WalletClient) => {
  if (!wallet.account) {
    throw new Error('Wallet account is undefined');
  }
  return wallet.account;
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

  // Get the proposal stats to make sure the vote went through
  const votes = await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalVotes',
    args: [proposalId],
  });
  console.log('Proposal votes:', votes);

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

  if (state === 3) {
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
