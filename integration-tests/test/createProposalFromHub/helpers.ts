import {
  createArbitraryProposalData,
  createProposalViaAggregateProposer,
} from 'test/helpers';

export const createProposalFromHub = async () => {
  const proposalData = await createArbitraryProposalData();
  const proposalId = await createProposalViaAggregateProposer({
    proposalData,
  });
  return proposalId;
};
