import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { voteFromSpoke } from './helpers';
import { getProposalVotes, getVotingPower } from 'test/helpers';
import { createClients } from 'test/config/clients';
import { createProposalOnSpoke } from 'test/createProposalOnSpoke/helpers';

describe('Vote from spoke', () => {
  let proposalId: bigint;

  beforeAll(async () => {
    await setupTestEnvironment();
    proposalId = await createProposalOnSpoke();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should successfully vote from spoke and bridge to hub', async () => {
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
  });
});
