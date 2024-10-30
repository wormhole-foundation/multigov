import { afterAll, beforeAll, describe, test } from 'bun:test';
import { createProposalOnSpoke } from 'test/createProposalOnSpoke/helpers';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { bridgeVotesToHub, voteFromSpoke } from './helpers';

describe('Vote from spoke', () => {
  let proposalId: bigint;

  beforeAll(async () => {
    await setupTestEnvironment();
    proposalId = await createProposalOnSpoke();
    console.log('🦄 ~ beforeAll ~ proposalId:', proposalId);
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should successfully vote from spoke', async () => {
    await voteFromSpoke();
  });

  test('should successfully bridge votes to hub', async () => {
    await bridgeVotesToHub();
  });
});
