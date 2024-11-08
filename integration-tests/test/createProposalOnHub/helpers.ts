import {
  createArbitraryProposalData,
  createProposalViaAggregateProposer,
} from 'test/helpers';

export const createProposalOnHub = async () => {
  console.log('Creating proposal on hub...');
  const proposalData = await createArbitraryProposalData();
  const proposalId = await createProposalViaAggregateProposer({
    proposalData,
  });
  console.log('✅ Proposal created on hub');
  return proposalId;
};
