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
  createTokenMintProposalData,
} from './executeCrossChain/helpers';
import { getVotingTokenBalance } from './helpers';
import {
  createArbitraryProposalData,
  createProposalViaAggregateProposer,
  getProposal,
  waitForProposalToBeActive,
} from './helpers/governance/proposalHelpers';
import { getWhitelistedProposer } from './helpers/governance/registrationHelpers';
import { type ProposalData, ProposalState } from './helpers/governance/types';
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
      expect(proposal.state).toEqual(ProposalState.Pending);

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
    test('Should successfully perform cross-chain token mint', async () => {
      const { eth2Client, account } = createClients();

      const mintAmount = parseEther('1000'); // 1000 tokens (token is 18 decimals)

      const balanceBefore = await getVotingTokenBalance({
        account: account.address,
        client: eth2Client,
        tokenAddress: ContractAddresses.SPOKE_VOTING_TOKEN,
      });

      const proposalData = createTokenMintProposalData({
        recipient: account.address,
        amount: mintAmount,
        tokenAddress: ContractAddresses.SPOKE_VOTING_TOKEN,
      });

      // Create and execute proposal for token minting
      await createAndExecuteCrossChainProposal(proposalData);

      const balanceAfter = await getVotingTokenBalance({
        account: account.address,
        client: eth2Client,
        tokenAddress: ContractAddresses.SPOKE_VOTING_TOKEN,
      });

      // Verify the mint was successful
      expect(balanceAfter).toBe(balanceBefore + mintAmount);
    }, 120000);
  });
});
