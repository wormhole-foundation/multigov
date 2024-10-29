import type { createClients } from './clients';

export enum VoteType {
  AGAINST = 0,
  FOR = 1,
  ABSTAIN = 2,
}

export type Client =
  | ReturnType<typeof createClients>['ethClient']
  | ReturnType<typeof createClients>['eth2Client'];
export type Wallet =
  | ReturnType<typeof createClients>['ethWallet']
  | ReturnType<typeof createClients>['eth2Wallet'];
