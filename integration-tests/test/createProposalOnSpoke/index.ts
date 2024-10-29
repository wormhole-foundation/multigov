import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { getProposal, getVoteStart } from 'test/helpers';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { createProposalOnSpoke, getProposalOnSpoke } from './helpers';

describe('Create proposal on spoke', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should create proposal on spoke', async () => {
    const proposalId = await createProposalOnSpoke();
    const spokeProposalData = await getProposalOnSpoke(proposalId);
    const hubProposalData = await getProposal(proposalId);

    expect(spokeProposalData.voteStart).toEqual(
      await getVoteStart({ proposalId }),
    );
    expect(hubProposalData.id).toEqual(proposalId);
  }, 120000); // Timeout to 2 minutes to allow for query server updates to handle finality
});
