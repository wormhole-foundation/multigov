import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { ContractAddresses } from 'test/config/addresses';
import { getProposal } from 'test/helpers/governance/proposalHelpers';
import { getWhitelistedProposer } from 'test/helpers/governance/registrationHelpers';
import { setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { createProposalFromHub } from './helpers';

describe('Create proposal from hub', () => {
  beforeAll(async () => {
    await setupTestEnvironment();

    // check to make sure hubevmspokeaggregate proposer is whitelisted
    const isWhitelisted = await getWhitelistedProposer();
    expect(isWhitelisted).toBe(
      ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    );
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should create proposal from hub', async () => {
    const proposalId = await createProposalFromHub();
    expect(proposalId).toBeDefined();

    // check it exists in the governor
    const proposal = await getProposal(proposalId);
    expect(proposal).toBeDefined();
    expect(proposal.id).toBe(proposalId);
    expect(proposal.proposer).toBe(
      ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
    );
  });
});
