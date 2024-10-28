import { afterAll, beforeAll, describe, test } from 'bun:test';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { executeCrossChain } from './helpers';

describe('Execute cross chain', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should execute cross chain proposal', async () => {
    await executeCrossChain();
  });
});
