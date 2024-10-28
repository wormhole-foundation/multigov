import { createArbitraryProposalData, createProposal } from 'test/helpers';

export const createProposalFromHub = async () => {
  const proposalData = await createArbitraryProposalData();
  const proposalId = await createProposal({
    proposalData,
  });
  return proposalId;
  // TODO: Add the rest of the logic to create a proposal from hub
};
