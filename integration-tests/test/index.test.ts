import { afterAll, beforeAll, describe } from 'bun:test';
import { setupTestEnvironment, teardownTestEnvironment } from './setup';

describe('MultiGov Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });
});

// Import all test files
import './proposeFromSpoke';
import './createProposalOnSpoke';
import './voteFromSpoke';
import './executeCrossChain';
import './createProposalFromHub';
