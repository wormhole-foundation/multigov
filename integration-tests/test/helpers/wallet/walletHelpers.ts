import type { WalletClient } from 'viem';

export const handleNoAccount = (wallet: WalletClient) => {
  if (!wallet.account) {
    throw new Error('Wallet account is undefined');
  }
  return wallet.account;
};
