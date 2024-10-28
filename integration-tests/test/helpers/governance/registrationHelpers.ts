import {
  type Account,
  type Address,
  encodeFunctionData,
  zeroAddress,
} from 'viem';
import {
  HubEvmSpokeAggregateProposerAbi,
  HubGovernorAbi,
  HubVotePoolAbi,
} from '../../../abis';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';
import { VoteType } from '../../config/types';
import {
  createProposal,
  createProposalData,
  executeProposal,
} from './proposalHelpers';
import { voteOnProposal } from './votingHelpers';

export const getWhitelistedProposer = async () => {
  const { ethClient } = createClients();
  return await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'whitelistedProposer',
  });
};

export const isSpokeRegisteredOnAggProposer = async ({
  chainId,
}: {
  chainId: number;
}) => {
  const { ethClient } = createClients();
  const spokeAddress = await ethClient.readContract({
    address: ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    abi: HubEvmSpokeAggregateProposerAbi,
    functionName: 'registeredSpokes',
    args: [chainId],
  });

  return spokeAddress === ContractAddresses.SPOKE_VOTE_AGGREGATOR;
};

export const handleRegisterSpokeOnAggProposer = async ({
  chainId,
}: {
  chainId: number;
}) => {
  const isRegistered = await isSpokeRegisteredOnAggProposer({ chainId });
  if (isRegistered) {
    return;
  }

  return await registerSpokeOnAggProposer({
    chainId,
    spokeAddress: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
  });
};

const registerSpokeOnAggProposer = async ({
  chainId,
  spokeAddress,
}: {
  chainId: number;
  spokeAddress: Address;
}) => {
  const { ethClient, ethWallet } = createClients();

  await ethClient.setBalance({
    address: ContractAddresses.HUB_GOVERNOR,
    value: 1000000000000000000000000n,
  });

  // Owner of the HubEvmSpokeAggregateProposer
  await ethClient.impersonateAccount({
    address: ContractAddresses.HUB_GOVERNOR,
  });

  const hash = await ethWallet.writeContract({
    account: ContractAddresses.HUB_GOVERNOR,
    address: ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    abi: HubEvmSpokeAggregateProposerAbi,
    functionName: 'registerSpoke',
    args: [chainId, spokeAddress],
  });

  await ethClient.stopImpersonatingAccount({
    address: ContractAddresses.HUB_GOVERNOR,
  });

  console.log(
    `Registered spoke for chain ${chainId} at address ${spokeAddress}. Transaction hash: ${hash}`,
  );
};

export const handleRegisterSpokeOnHubVotePool = async ({
  chainId,
}: {
  chainId: number;
}) => {
  const isRegistered = await isSpokeRegisteredOnHubVotePool({ chainId });
  if (isRegistered) {
    return;
  }

  return await registerSpokeOnHubVotePool({
    chainId,
    spokeAddress: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
  });
};

export const isSpokeRegisteredOnHubVotePool = async ({
  chainId,
}: {
  chainId: number;
}) => {
  const { ethClient } = createClients();
  const timestamp = (await ethClient.getBlock()).timestamp;
  const spokeAddress = await ethClient.readContract({
    address: ContractAddresses.HUB_VOTE_POOL,
    abi: HubVotePoolAbi,
    functionName: 'getSpoke',
    args: [chainId, timestamp],
  });
  return spokeAddress !== zeroAddress;
};

export const registerSpokeOnHubVotePool = async ({
  chainId,
  spokeAddress,
}: {
  chainId: number;
  spokeAddress: Address;
}) => {
  const { ethClient, ethWallet } = createClients();
  const registerSpokeCalldata = encodeFunctionData({
    abi: HubVotePoolAbi,
    functionName: 'registerSpoke',
    args: [chainId, spokeAddress],
  });

  const proposalData = createProposalData({
    targets: [ContractAddresses.HUB_VOTE_POOL],
    values: [0n],
    calldatas: [registerSpokeCalldata],
    description: `Register spoke for chain ${chainId} at address ${spokeAddress}`,
  });

  const proposalId = await createProposal({
    proposalData,
  });

  console.log(
    `Created proposal to register spoke for chain ${chainId} at address ${spokeAddress}. Proposal ID: ${proposalId}`,
  );

  // Fast forward to the vote start
  const voteStart = await getVoteStart({ proposalId });
  await ethClient.setNextBlockTimestamp({ timestamp: voteStart });

  // Vote on the proposal to make it pass
  await voteOnProposal({
    isHub: true,
    proposalId,
    voteType: VoteType.FOR,
  });

  // Fast forward to the end of voting period
  const voteEnd = await getVoteEnd({ proposalId });
  await ethClient.setNextBlockTimestamp({ timestamp: voteEnd + 1n });
  await ethClient.mine({ blocks: 1 });

  // Execute the proposal
  const hash = await executeProposal({
    wallet: ethWallet,
    proposalId,
    proposalData,
  });

  return hash;
};

export const registerWhitelistedProposer = async ({
  proposerAddress,
}: {
  proposerAddress: Address;
  account: Account;
}) => {
  const { ethClient, ethWallet } = createClients();

  // Impersonate the HubGovernor
  await ethClient.impersonateAccount({
    address: ContractAddresses.HUB_GOVERNOR,
  });

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'setWhitelistedProposer',
    args: [proposerAddress],
    account: ContractAddresses.HUB_GOVERNOR,
    chain: ethWallet.chain,
  });

  await ethClient.stopImpersonatingAccount({
    address: ContractAddresses.HUB_GOVERNOR,
  });

  console.log(
    `Registered whitelisted proposer at address ${proposerAddress}. Transaction hash: ${hash}`,
  );
  return hash;
};

const getVoteStart = async ({ proposalId }: { proposalId: bigint }) => {
  const { ethClient } = createClients();

  return await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalSnapshot',
    args: [proposalId],
  });
};

const getVoteEnd = async ({ proposalId }: { proposalId: bigint }) => {
  const { ethClient } = createClients();
  return await ethClient.readContract({
    address: ContractAddresses.HUB_GOVERNOR,
    abi: HubGovernorAbi,
    functionName: 'proposalDeadline',
    args: [proposalId],
  });
};
