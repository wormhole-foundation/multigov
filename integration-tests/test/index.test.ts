import { beforeAll, describe } from 'bun:test';
import { setupTestEnvironment } from './setup';

describe('MultiGov Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });
});

// Import all test files
import './proposeFromSpoke';
import './createProposalOnSpoke';
import './voteFromSpoke';
import './executeCrossChain';
import './createProposalOnHub';
