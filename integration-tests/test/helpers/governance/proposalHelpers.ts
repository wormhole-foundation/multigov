import {
  type Address,
  type WalletClient,
  encodeFunctionData,
  keccak256,
  toBytes,
} from 'viem';
import { HubEvmSpokeAggregateProposerAbi, HubGovernorAbi } from '../../../abis';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';
import { getWormholeGetVotesQueryResponse } from '../wormhole/wormholeHelpers';
import { getVotingPower } from './votingHelpers';

export function createProposalData({
  targets,
  values,
  calldatas,
  description,
}: {
  targets: Address[];
  values: bigint[];
  calldatas: `0x${string}`[];
  description: string;
}) {
  return {
    targets,
    values,
    calldatas,
    description,
  };
}

export const createProposal = async ({
  proposalData,
}: {
  proposalData: ReturnType<typeof createProposalData>;
}) => {
  const { ethClient, eth2Client, ethWallet, account } = createClients();

  // Use a past timestamp to account for limitations in the query server
  // Use 5 minutes ago
  const timestampHub = (await ethClient.getBlock()).timestamp - 300n;
  const timestampSpoke = (await eth2Client.getBlock()).timestamp - 300n;

  // Debug: Check voting power
  const hubVotingPower = await getVotingPower({
    account: account.address,
    isHub: true,
    timestamp: timestampHub,
  });
  const spokeVotingPower = await getVotingPower({
    account: account.address,
    isHub: false,
    timestamp: timestampSpoke,
  });
  console.log(`Hub voting power: ${hubVotingPower}`);
  console.log(`Spoke voting power: ${spokeVotingPower}`);

  const { queryResponseBytes, queryResponseSignatures } =
    await getWormholeGetVotesQueryResponse({
      account: account.address,
      timestampSpoke,
    });

  // Debug: Log query response
  console.log('Query response bytes:', queryResponseBytes);
  console.log('Query response signatures:', queryResponseSignatures);

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
  wallet: WalletClient;
  proposalId: bigint;
  proposalData: ReturnType<typeof createProposalData>;
}) => {
  const descriptionHash = keccak256(toBytes(proposalData.description));
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
  return hash;
};

export const createArbitraryProposalData = async () => {
  const { ethClient } = createClients();

  const timestamp = (await ethClient.getBlock()).timestamp;
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
    description: `Arbitrary proposal to set quorum to ${newQuorum}`,
  };
};

const handleNoAccount = (wallet: WalletClient) => {
  if (!wallet.account) {
    throw new Error('Wallet account is undefined');
  }
  return wallet.account;
};
