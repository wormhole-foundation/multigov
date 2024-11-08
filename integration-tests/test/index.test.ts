import { beforeAll, describe } from 'bun:test';
import { setupTestEnvironment } from './setup';
import { setSetupSuccessful } from './testContext';

describe('MultiGov Tests', () => {
  beforeAll(async () => {
    try {
      await setupTestEnvironment();
      setSetupSuccessful(true);
    } catch (error) {
      console.error('\n❌ Test environment setup failed:', error);
      setSetupSuccessful(false);
      throw error;
    }
  });
});

// Import all test files
import './createProposalOnHub';
import './createProposalOnSpoke';
import './voteFromSpoke';
import './executeCrossChain';
