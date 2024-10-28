import { afterAll, beforeAll, describe, test } from 'bun:test';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import {
  addProposalToSpoke,
  createProposalOnSpoke,
  dispatchProposalToHub,
} from './helpers';

describe('Create proposal on spoke', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should create proposal on spoke', async () => {
    const proposalId = await createProposalOnSpoke();
    await dispatchProposalToHub(proposalId);
    await addProposalToSpoke(proposalId);
    // check proposal created on spoke
  });
});
