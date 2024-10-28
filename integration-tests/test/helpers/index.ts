import type { Address } from 'viem';

export function createProposalData({
  targets,
  values,
  calldatas,
  description,
}: {
  targets: Address[];
  values: bigint[];
  calldatas: `0x${string}`[];
  description: string;
}) {
  return {
    targets,
    values,
    calldatas,
    description,
  };
}

// Export all helpers from their respective files
export * from './governance/proposalHelpers';
export * from './governance/votingHelpers';
export * from './governance/registrationHelpers';
export * from './token/tokenHelpers';
export * from './time/timeHelpers';
export * from './wormhole/wormholeHelpers';
