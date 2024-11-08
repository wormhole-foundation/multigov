import { describe, expect, test } from 'bun:test';
import { getProposal, getVoteStart } from 'test/helpers';
import { setupSuccessful } from 'test/testContext';
import { createProposalOnSpoke, getProposalOnSpoke } from './helpers';
describe('Create proposal on spoke', () => {
  test.if(setupSuccessful)(
    'should create proposal on spoke',
    async () => {
      const proposalId = await createProposalOnSpoke();
      const spokeProposalData = await getProposalOnSpoke(proposalId);
      const hubProposalData = await getProposal(proposalId);

      expect(spokeProposalData.voteStart).toEqual(
        await getVoteStart({ proposalId }),
      );
      expect(hubProposalData.id).toEqual(proposalId);
    },
    120000,
  ); // Timeout to 2 minutes to allow for query server updates to handle finality
});
