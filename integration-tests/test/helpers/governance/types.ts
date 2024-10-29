import type { Address } from 'viem';

export type ProposalData = {
  targets: Address[];
  values: bigint[];
  calldatas: `0x${string}`[];
  description: string;
};
