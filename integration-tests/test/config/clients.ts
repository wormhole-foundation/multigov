import {
  http,
  createTestClient,
  createWalletClient,
  publicActions,
} from 'viem';
import {
  ETH2_DEVNET_NODE_URL,
  ETH_DEVNET_NODE_URL,
  eth2Devnet,
  ethDevnet,
} from './chains';
import { account } from './mainAccount';

export const createClients = () => {
  const ethClient = createTestClient({
    mode: 'anvil',
    chain: ethDevnet,
    transport: http(ETH_DEVNET_NODE_URL),
  }).extend(publicActions);

  const eth2Client = createTestClient({
    mode: 'anvil',
    chain: eth2Devnet,
    transport: http(ETH2_DEVNET_NODE_URL),
  }).extend(publicActions);

  const ethWallet = createWalletClient({
    account,
    chain: ethDevnet,
    transport: http(ETH_DEVNET_NODE_URL),
  });

  const eth2Wallet = createWalletClient({
    account,
    chain: eth2Devnet,
    transport: http(ETH2_DEVNET_NODE_URL),
  });

  return { ethClient, eth2Client, ethWallet, eth2Wallet, account };
};
