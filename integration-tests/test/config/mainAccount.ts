import { toHex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

const MNEMONIC = process.env.ETHDEVNET_MNEMONIC;

if (!MNEMONIC) {
  throw new Error('ETHDEVNET_MNEMONIC environment variable is not set');
}

export const account = mnemonicToAccount(MNEMONIC);
export const getPrivateKeyHex = () => {
  const privateKey = account.getHdKey().privateKey;
  if (!privateKey) {
    throw new Error('Private key not found');
  }
  return toHex(privateKey, { size: 32 });
};
