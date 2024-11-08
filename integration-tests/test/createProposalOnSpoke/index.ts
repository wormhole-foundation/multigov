import { describe, expect, test } from 'bun:test';
import { getProposal, getVoteStart } from 'test/helpers';
import { createProposalOnSpoke, getProposalOnSpoke } from './helpers';

describe('Create proposal on spoke', () => {
  test('should create proposal on spoke', async () => {
    console.log('\n🔍 Testing spoke proposal creation...');
    const proposalId = await createProposalOnSpoke();
    const spokeProposalData = await getProposalOnSpoke(proposalId);
    const hubProposalData = await getProposal(proposalId);

    expect(spokeProposalData.voteStart).toEqual(
      await getVoteStart({ proposalId, isHub: true }),
    );
    expect(hubProposalData.id).toEqual(proposalId);
    console.log('✅ Spoke proposal creation test passed');
  }, 120000); // Timeout to 2 minutes to allow for query server updates to handle finality
});
