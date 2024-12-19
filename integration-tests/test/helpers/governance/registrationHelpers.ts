import type { Client, Wallet } from 'test/config/types';
import { type Address, encodeFunctionData, getAddress, parseEther } from 'viem';
import {
  HubEvmSpokeAggregateProposerAbi,
  HubGovernorAbi,
  HubVotePoolAbi,
} from '../../../abis';
import { ContractAddresses, addressStore } from '../../config/addresses';
import { createClients } from '../../config/clients';
import { toWormholeFormat } from '../wormhole/wormholeHelpers';
import {
  createAndExecuteProposalViaHubGovernor,
  createProposalData,
} from './proposalHelpers';

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

  return (
    getAddress(spokeAddress) ===
    getAddress(ContractAddresses.SPOKE_VOTE_AGGREGATOR)
  );
};

export const handleRegisterSpokeOnAggProposer = async ({
  chainId,
}: {
  chainId: number;
}) => {
  console.log('\n🔍 Checking if spoke is registered on AggProposer...');
  const isRegistered = await isSpokeRegisteredOnAggProposer({ chainId });
  if (isRegistered) {
    console.log('✅ Spoke is already registered on AggProposer');
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
  console.log('\n📝 Registering spoke on AggProposer...');
  console.log(`   Chain ID: ${chainId}`);
  console.log(`   Spoke Address: ${spokeAddress}`);

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

  await ethClient.waitForTransactionReceipt({ hash });

  console.log('✅ Spoke registered successfully on AggProposer');
};

export const handleRegisterSpokeOnHubVotePool = async ({
  chainId,
}: {
  chainId: number;
}) => {
  console.log('\n🔍 Checking if spoke is registered on HubVotePool...');
  const isRegistered = await isSpokeRegisteredOnHubVotePool({
    chainId,
    spokeAddress: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
  });

  if (isRegistered) {
    console.log('✅ Spoke already registered on HubVotePool');
    return;
  }

  return await registerSpokeOnHubVotePool({
    chainId,
    spokeAddress: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
  });
};

export const isSpokeRegisteredOnHubVotePool = async ({
  chainId,
  spokeAddress,
}: {
  chainId: number;
  spokeAddress: Address;
}) => {
  const { ethClient } = createClients();
  const timestamp = (await ethClient.getBlock()).timestamp;
  const registeredAddress = await ethClient.readContract({
    address: addressStore.getAddress('HUB_VOTE_POOL'),
    abi: HubVotePoolAbi,
    functionName: 'getSpoke',
    args: [chainId, timestamp],
  });

  return (
    registeredAddress.toLowerCase() ===
    toWormholeFormat(spokeAddress).toLowerCase()
  );
};

export const registerSpokeOnHubVotePool = async ({
  chainId,
  spokeAddress,
}: {
  chainId: number;
  spokeAddress: Address;
}) => {
  console.log('\n📝 Registering spoke on HubVotePool...');
  const { ethClient } = createClients();
  const timestamp = (await ethClient.getBlock()).timestamp;
  const nonce = Math.floor(Math.random() * 1000000);

  // Convert the spoke address to Wormhole format before registering
  const spokeAddressBytes32 = toWormholeFormat(spokeAddress);

  const registerSpokeCalldata = encodeFunctionData({
    abi: HubVotePoolAbi,
    functionName: 'registerSpoke',
    args: [chainId, spokeAddressBytes32],
  });

  const proposalData = createProposalData({
    targets: [ContractAddresses.HUB_VOTE_POOL],
    values: [0n],
    calldatas: [registerSpokeCalldata],
    description: `Register spoke for chain ${chainId} at address ${spokeAddressBytes32} at timestamp ${timestamp} (nonce: ${nonce})`,
  });

  // Add gas price to proposal creation
  const proposalId = await createAndExecuteProposalViaHubGovernor(proposalData);

  console.log('✅ Spoke registration proposal created');
  console.log(`   Proposal ID: ${proposalId}`);
  return proposalId;
};

export async function registerWhitelistedProposer({
  proposerAddress,
}: {
  proposerAddress: Address;
}) {
  const { ethClient } = createClients();
  const timestamp = (await ethClient.getBlock()).timestamp;
  const nonce = Math.floor(Math.random() * 1000000);

  const proposalData = createProposalData({
    targets: [ContractAddresses.HUB_GOVERNOR],
    values: [0n],
    calldatas: [
      encodeFunctionData({
        abi: HubGovernorAbi,
        functionName: 'setWhitelistedProposer',
        args: [proposerAddress],
      }),
    ],
    description: `Set whitelisted proposer to ${proposerAddress} at timestamp ${timestamp} (nonce: ${nonce})`,
  });

  const proposalId = await createAndExecuteProposalViaHubGovernor(proposalData);

  console.log(
    `Set whitelisted proposer to ${proposerAddress}. Proposal ID: ${proposalId}`,
  );
}

export const checkContractOwnership = async ({
  contractAddress,
  client,
}: { contractAddress: Address; client: Client | Wallet }) => {
  return await client.readContract({
    address: contractAddress,
    abi: [
      {
        inputs: [],
        name: 'owner',
        outputs: [{ type: 'address', name: '' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'owner',
  });
};

export const handleTransferOwnership = async ({
  contractAddress,
  newOwner,
  wallet,
  client,
}: {
  contractAddress: Address;
  newOwner: Address;
  wallet: Wallet;
  client: Client;
}) => {
  console.log('\n👑 Checking ownership...');
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   New Owner: ${newOwner}`);

  const owner = await checkContractOwnership({ contractAddress, client });

  if (owner === getAddress(newOwner)) {
    console.log('✅ Ownership already correct');
    return;
  }

  console.log('\n📝 Transferring ownership...');

  await client.setBalance({
    address: owner,
    value: parseEther('1'),
  });

  await client.impersonateAccount({
    address: owner,
  });

  await wallet.simulateContract({
    address: contractAddress,
    abi: HubVotePoolAbi,
    functionName: 'transferOwnership',
    args: [newOwner],
    account: owner,
  });

  const hash = await wallet.writeContract({
    address: contractAddress,
    abi: HubVotePoolAbi,
    functionName: 'transferOwnership',
    args: [newOwner],
    account: owner,
  });

  await client.stopImpersonatingAccount({
    address: owner,
  });

  console.log('✅ Ownership transferred successfully');

  await client.waitForTransactionReceipt({ hash });
};
