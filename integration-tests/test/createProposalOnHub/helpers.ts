import { createProposalViaAggregateProposer } from 'test/helpers';
import type { ProposalData } from 'test/helpers/governance/types';

export const createProposalOnHub = async (proposalData: ProposalData) => {
  console.log('Creating proposal on hub...');
  const proposalId = await createProposalViaAggregateProposer({
    proposalData,
  });
  console.log('✅ Proposal created on hub');
  return proposalId;
};
