import { beforeAll, describe, expect, test } from 'bun:test';
import { createClients } from 'test/config/clients';
import { createProposalOnSpoke } from 'test/createProposalOnSpoke/helpers';
import {
  getProposalVotes,
  getVotingPower,
  waitForProposalToBeActive,
} from 'test/helpers';
import { voteFromSpoke } from './helpers';

describe('Vote from spoke', () => {
  let proposalId: bigint;

  beforeAll(async () => {
    proposalId = await createProposalOnSpoke();
    console.log('Waiting for proposal to be active...');
    await waitForProposalToBeActive(proposalId);
    console.log('Proposal is now active');
  });

  test('should successfully vote from spoke and bridge to hub', async () => {
    const { account, ethClient } = createClients();

    console.log('Getting initial vote weight and votes...');
    const voteWeight = await getVotingPower({
      account: account.address,
      isHub: true,
      timestamp: (await ethClient.getBlock()).timestamp,
    });

    const votesBeforeOnHub = await getProposalVotes({
      proposalId,
      isHub: true,
    });
    console.log('Initial votes on hub:', votesBeforeOnHub);

    console.log('Voting from spoke and bridging...');
    await voteFromSpoke(proposalId);
    console.log('Vote and bridge completed');

    console.log('Getting final votes...');
    const votesAfterOnHub = await getProposalVotes({
      proposalId,
      isHub: true,
    });
    console.log('Final votes on hub:', votesAfterOnHub);

    expect(votesAfterOnHub.forVotes).toBe(
      votesBeforeOnHub.forVotes + voteWeight,
    );
  }, 120000); // Timeout to 2 minutes to allow for query server updates to handle finality
});
