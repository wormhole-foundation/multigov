import type { createClients } from './clients';

export enum VoteType {
  FOR = 1,
  AGAINST = 0,
}

export type Client =
  | ReturnType<typeof createClients>['ethClient']
  | ReturnType<typeof createClients>['eth2Client'];
export type Wallet =
  | ReturnType<typeof createClients>['ethWallet']
  | ReturnType<typeof createClients>['eth2Wallet'];
