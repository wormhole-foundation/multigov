import { afterAll, beforeAll, describe, test } from 'bun:test';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { proposeFromSpoke } from './helpers';

describe('Proposing from spoke', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should successfully propose from spoke', async () => {
    await proposeFromSpoke();
  });
});
