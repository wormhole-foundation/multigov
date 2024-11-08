import { describe, expect, test } from 'bun:test';
import { createClients } from 'test/config/clients';
import { createProposalOnSpoke } from 'test/createProposalOnSpoke/helpers';
import {
  getProposalVotes,
  getVotingPower,
  waitForProposalToBeActive,
} from 'test/helpers';
import { voteFromSpoke } from './helpers';

describe('Vote from spoke', () => {
  test('should successfully vote from spoke and bridge to hub', async () => {
    console.log('\n🔍 Testing vote from spoke...');

    const proposalId = await createProposalOnSpoke();
    await waitForProposalToBeActive(proposalId);
    const { account, ethClient } = createClients();

    const voteWeight = await getVotingPower({
      account: account.address,
      isHub: true,
      timestamp: (await ethClient.getBlock()).timestamp,
    });

    const votesBeforeOnHub = await getProposalVotes({
      proposalId,
      isHub: true,
    });

    await voteFromSpoke(proposalId);

    const votesAfterOnHub = await getProposalVotes({
      proposalId,
      isHub: true,
    });

    expect(votesAfterOnHub.forVotes).toBe(
      votesBeforeOnHub.forVotes + voteWeight,
    );
    console.log('✅ Vote from spoke test passed');
  }, 120000); // Timeout to 2 minutes to allow for query server updates to handle finality
});
