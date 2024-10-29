import type { Address } from 'viem';

export interface ProposalData {
  targets: Address[];
  values: bigint[];
  calldatas: `0x${string}`[];
  description: string;
}

export interface ProposalVotes {
  againstVotes: bigint;
  forVotes: bigint;
  abstainVotes: bigint;
}

export interface ProposalInfo {
  id: bigint;
  state: number;
  votes: ProposalVotes;
  snapshot: bigint;
  deadline: bigint;
  proposer: Address;
  eta: bigint;
}
