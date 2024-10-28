import { afterAll, beforeAll, describe, test } from 'bun:test';
import {
  addProposalToSpoke,
  createProposalOnSpoke,
  dispatchProposalToHub,
} from 'test/createProposalOnSpoke/helpers';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { voteFromSpoke } from './helpers';

describe('Vote from spoke', () => {
  let proposalId: bigint;

  beforeAll(async () => {
    await setupTestEnvironment();
    proposalId = await createProposalOnSpoke();
    await dispatchProposalToHub(proposalId);
    await addProposalToSpoke(proposalId);
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should successfully vote from spoke', async () => {
    await voteFromSpoke();
  });
});
