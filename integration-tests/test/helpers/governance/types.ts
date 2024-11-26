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

export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}
export interface ProposalInfo {
  id: bigint;
  state: ProposalState;
  votes: ProposalVotes;
  snapshot: bigint;
  deadline: bigint;
  proposer: Address;
  eta: bigint;
}
