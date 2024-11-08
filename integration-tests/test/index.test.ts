import { beforeAll, describe } from 'bun:test';
import { setupTestEnvironment } from './setup';

describe('MultiGov Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });
});

// Import all test files
import './createProposalOnHub';
import './createProposalOnSpoke';
import './voteFromSpoke';
import './executeCrossChain';
