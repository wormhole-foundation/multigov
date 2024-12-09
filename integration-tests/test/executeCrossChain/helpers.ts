import { HubMessageDispatcherAbi, SpokeMessageExecutorAbi } from 'abis';
import WormholeCoreAbi from 'abis/WormholeCoreAbi';
import { ContractAddresses } from 'test/config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from 'test/config/chains';
import { createClients } from 'test/config/clients';
import { toWormholeFormat } from 'test/helpers';
import {
  createAndExecuteProposalViaHubGovernor,
  createProposalData,
} from 'test/helpers/governance/proposalHelpers';
import type { ProposalData } from 'test/helpers/governance/types';
import { encodeAbiParameters, encodeFunctionData, parseAbiItem } from 'viem';

// Main function to create and execute a cross-chain proposal
export const createAndExecuteCrossChainProposal = async (
  proposalData: ProposalData,
) => {
  console.log('Creating and executing cross-chain proposal...');
  const { proposalId, sequence } =
    await createProposalWithDispatcher(proposalData);
  const vaaBytes = await fetchSignedVAA(sequence);
  await executeVAAOnSpoke(vaaBytes);
  console.log('✅ Cross-chain proposal executed');
  return proposalId;
};

// Create a proposal that will be dispatched via the HubMessageDispatcher
const createProposalWithDispatcher = async (proposalData: ProposalData) => {
  console.log('🔍 Creating proposal with dispatch...');
  const { ethClient } = createClients();
  const messageFee = await ethClient.readContract({
    address: ContractAddresses.WORMHOLE_CORE,
    abi: WormholeCoreAbi,
    functionName: 'messageFee',
  });

  // Encode the cross-chain message payload
  const payload = encodeAbiParameters(
    [
      { type: 'uint16' },
      { type: 'address[]' },
      { type: 'uint256[]' },
      { type: 'bytes[]' },
    ],
    [
      ETH2_DEVNET_WORMHOLE_CHAIN_ID,
      proposalData.targets,
      proposalData.values,
      proposalData.calldatas || ['0x'],
    ],
  );

  // Create proposal to call dispatch on HubMessageDispatcher
  const nonce = Math.floor(Math.random() * 1000000);

  const hubProposalData = createProposalData({
    targets: [ContractAddresses.HUB_MESSAGE_DISPATCHER],
    values: [messageFee],
    calldatas: [
      encodeFunctionData({
        abi: HubMessageDispatcherAbi,
        functionName: 'dispatch',
        args: [payload],
      }),
    ],
    description: `Cross-chain execution via HubMessageDispatcher with nonce ${nonce}`,
  });

  const proposalId =
    await createAndExecuteProposalViaHubGovernor(hubProposalData);
  const sequence = await getMessageSequence();
  console.log('✅ Proposal with dispatch created');
  return { proposalId, sequence };
};

// Fetch the signed VAA from the Wormhole guardian
const fetchSignedVAA = async (sequence: bigint): Promise<`0x${string}`> => {
  console.log('🔍 Fetching signed VAA...');
  const emitterAddress = toWormholeFormat(
    ContractAddresses.HUB_MESSAGE_DISPATCHER,
  ).slice(2);
  const MAX_RETRIES = 30;
  const RETRY_DELAY = 2000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(
        `http://localhost:7071/v1/signed_vaa/2/${emitterAddress}/${sequence}`,
      );

      if (response.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch VAA: ${response.statusText}`);
      }

      const { vaaBytes } = (await response.json()) as { vaaBytes: string };
      if (!vaaBytes) throw new Error('VAA bytes missing from response');

      console.log('✅ Signed VAA fetched');
      return `0x${Buffer.from(vaaBytes, 'base64').toString('hex')}` as const;
    } catch (error) {
      if (i === MAX_RETRIES - 1)
        throw new Error(`Failed to fetch VAA: ${error}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw new Error('Failed to fetch VAA: Max retries exceeded');
};

// Execute the VAA on the spoke chain
const executeVAAOnSpoke = async (vaa: `0x${string}`) => {
  console.log('🔍 Executing VAA on spoke...');
  const { eth2Client, eth2Wallet } = createClients();

  const hash = await eth2Wallet.writeContract({
    address: ContractAddresses.SPOKE_MESSAGE_EXECUTOR,
    abi: SpokeMessageExecutorAbi,
    functionName: 'receiveMessage',
    args: [vaa],
  });

  await eth2Client.waitForTransactionReceipt({ hash });
  console.log('✅ VAA executed on spoke');
};

// Get the sequence number from the latest Wormhole message
const getMessageSequence = async () => {
  console.log('🔍 Getting message sequence...');
  const { ethClient } = createClients();
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 20000; // 20 seconds

  for (let i = 0; i < MAX_RETRIES; i++) {
    const logs = await ethClient.getLogs({
      address: ContractAddresses.WORMHOLE_CORE,
      event: parseAbiItem(
        'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
      ),
      fromBlock: 'earliest',
      toBlock: 'latest',
      args: {
        sender: ContractAddresses.HUB_MESSAGE_DISPATCHER,
      },
    });

    const log = logs[logs.length - 1];

    if (log?.args?.sequence !== undefined) {
      // Wait for guardian to process
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      console.log('✅ Message sequence fetched:', log.args.sequence.toString());
      return log.args.sequence;
    }

    console.log(`No sequence found on attempt ${i + 1}, retrying...`);
    if (i < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw new Error(`No sequence found after ${MAX_RETRIES} attempts`);
};

// Helper to create proposal data for ETH transfer
export const createArbitraryProposalDataForSpokeExecution = ({
  recipient,
  amount,
}: {
  recipient: `0x${string}`;
  amount: bigint;
}) =>
  createProposalData({
    targets: [recipient],
    values: [amount],
    calldatas: ['0x'],
    description: 'Arbitrary proposal data for spoke execution',
  });

// Get the SpokeAirlock address
export const getSpokeAirlock = async () => {
  const { eth2Client } = createClients();
  return await eth2Client.readContract({
    address: ContractAddresses.SPOKE_MESSAGE_EXECUTOR,
    abi: SpokeMessageExecutorAbi,
    functionName: 'airlock',
  });
};
