import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { createProposalFromHub } from './helpers';

describe('Create proposal from hub', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should create proposal from hub', async () => {
    const proposalId = await createProposalFromHub();
    expect(proposalId).toBeDefined();
  });
});
