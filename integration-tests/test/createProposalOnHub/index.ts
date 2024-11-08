import { describe, expect, test } from 'bun:test';
import { getAddress } from 'viem';
import { ContractAddresses } from '../config/addresses';
import { getProposal } from '../helpers/governance/proposalHelpers';
import { getWhitelistedProposer } from '../helpers/governance/registrationHelpers';
import { createProposalOnHub } from './helpers';

describe('Create proposal on hub via the HubEvmSpokeAggregateProposer', () => {
  test('Should create proposal on hub', async () => {
    const isWhitelisted = await getWhitelistedProposer();

    expect(isWhitelisted).toBe(
      getAddress(ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER),
    );

    const proposalId = await createProposalOnHub();
    expect(proposalId).toBeDefined();

    // check it exists in the governor
    const proposal = await getProposal(proposalId);
    expect(proposal).toBeDefined();
    expect(proposal.id).toBe(proposalId);
    expect(proposal.proposer).toBe(
      getAddress(ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER),
    );
  });
});
