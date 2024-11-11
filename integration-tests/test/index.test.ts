import { beforeAll, describe, expect, test } from 'bun:test';
import { getAddress, parseEther } from 'viem';
import { ContractAddresses } from './config/addresses';
import { createClients } from './config/clients';
import {
  createProposalOnSpoke,
  getProposalOnSpoke,
} from './createProposalOnSpoke/helpers';
import {
  createAndExecuteCrossChainProposal,
  createArbitraryProposalDataForSpokeExecution,
  getSpokeAirlock,
} from './executeCrossChain/helpers';
import {
  createArbitraryProposalData,
  createProposalViaAggregateProposer,
  getProposal,
  waitForProposalToBeActive,
} from './helpers/governance/proposalHelpers';
import { getWhitelistedProposer } from './helpers/governance/registrationHelpers';
import type { ProposalData } from './helpers/governance/types';
import {
  getProposalVotes,
  getVoteStart,
  getVotingPower,
} from './helpers/governance/votingHelpers';
import { setupTestEnvironment } from './setup';
import { voteFromSpoke } from './voteFromSpoke/helpers';

// Store shared state between tests 1-3
type ProposalTestState = {
  proposalData?: ProposalData;
  hubProposalId?: bigint;
  spokeProposalId?: bigint;
};

const state: ProposalTestState = {};

describe('MultiGov Tests', () => {
  beforeAll(async () => {
    try {
      await setupTestEnvironment();
      console.log('\n🧪 Starting governance flow tests...');
    } catch (error) {
      console.error('\n❌ Test environment setup failed:', error);
      throw error;
    }
  });

  describe('1. Hub Proposal Creation', () => {
    test('Should create proposal on hub', async () => {
      console.log('\n🔍 Testing hub proposal creation...');
      const isWhitelisted = await getWhitelistedProposer();

      expect(isWhitelisted).toBe(
        getAddress(ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER),
      );

      const proposalData = await createArbitraryProposalData();
      state.proposalData = proposalData;

      const proposalId = await createProposalViaAggregateProposer({
        proposalData,
      });
      expect(proposalId).toBeDefined();

      // check it exists in the governor
      const proposal = await getProposal(proposalId);
      expect(proposal).toBeDefined();
      expect(proposal.id).toBe(proposalId);
      expect(proposal.proposer).toBe(
        getAddress(ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER),
      );

      state.hubProposalId = proposalId;
    }, 120000);
  });

  describe('2. Spoke Proposal Creation', () => {
    test('Should create proposal on spoke', async () => {
      if (!state.hubProposalId) {
        throw new Error('Hub proposal ID is not set');
      }
      console.log('\n🔍 Testing spoke proposal creation...');
      state.spokeProposalId = await createProposalOnSpoke(state.hubProposalId);
      const spokeProposalData = await getProposalOnSpoke(state.spokeProposalId);
      const hubProposalData = await getProposal(state.hubProposalId);

      expect(spokeProposalData.voteStart).toEqual(
        await getVoteStart({
          proposalId: state.hubProposalId,
          isHub: true,
        }),
      );
      expect(hubProposalData.id).toEqual(state.hubProposalId);
    }, 120000); // Timeout to 2 minutes to allow for query server updates to handle finality
  });

  describe('3. Voting Process', () => {
    test('Should successfully vote from spoke and bridge to hub', async () => {
      if (!state.spokeProposalId) {
        throw new Error('Spoke proposal ID is not set');
      }

      console.log('\n🔍 Testing vote from spoke...');

      await waitForProposalToBeActive(state.spokeProposalId);
      const { account, ethClient } = createClients();

      const voteWeight = await getVotingPower({
        account: account.address,
        isHub: true,
        timestamp: (await ethClient.getBlock()).timestamp,
      });

      const votesBeforeOnHub = await getProposalVotes({
        proposalId: state.spokeProposalId,
        isHub: true,
      });

      await voteFromSpoke(state.spokeProposalId);

      const votesAfterOnHub = await getProposalVotes({
        proposalId: state.spokeProposalId,
        isHub: true,
      });

      expect(votesAfterOnHub.forVotes).toBe(
        votesBeforeOnHub.forVotes + voteWeight,
      );
    }, 120000);
  });

  describe('4. Cross Chain Execution', () => {
    test('Should successfully perform cross-chain execution of ETH transfer from spoke airlock to recipient', async () => {
      console.log('\n🔍 Testing cross-chain execution...');
      const { eth2Client } = createClients();
      const AMOUNT_TO_TRANSFER_FROM_AIRLOCK = parseEther('0.1');

      // Set up test addresses
      const recipient = '0x1234000000000000000000000000000000000000' as const;
      const airlock = await getSpokeAirlock();

      // Set up initial balances
      await eth2Client.setBalance({
        address: airlock,
        value: AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      });
      await eth2Client.setBalance({ address: recipient, value: 0n });

      // Get initial balances for verification
      const initialAirlockBalance = await eth2Client.getBalance({
        address: airlock,
      });
      const initialRecipientBalance = await eth2Client.getBalance({
        address: recipient,
      });

      // Create and execute the cross-chain transfer
      const proposalData = createArbitraryProposalDataForSpokeExecution({
        recipient,
        amount: AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      });

      await createAndExecuteCrossChainProposal(proposalData);

      // Verify the transfer
      const finalAirlockBalance = await eth2Client.getBalance({
        address: airlock,
      });
      const finalRecipientBalance = await eth2Client.getBalance({
        address: recipient,
      });

      expect(initialAirlockBalance - finalAirlockBalance).toBe(
        AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      );
      expect(finalRecipientBalance - initialRecipientBalance).toBe(
        AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      );
    }, 120000);
  });
});
