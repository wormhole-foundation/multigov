import type { Chain } from 'viem';

// Use environment variables or fallback to localhost
export const ETH_DEVNET_NODE_URL = process.env.CI
  ? 'http://eth-devnet.wormhole.svc.cluster.local:8545'
  : 'http://localhost:8545';
export const ETH2_DEVNET_NODE_URL = process.env.CI
  ? 'http://eth-devnet2.wormhole.svc.cluster.local:8545'
  : 'http://localhost:8546';

export const ETH_DEVNET_WORMHOLE_CHAIN_ID = 2;
export const ETH2_DEVNET_WORMHOLE_CHAIN_ID = 4;

// Custom chain definitions
export const ethDevnet: Chain = {
  id: 1337,
  name: 'Ethereum Devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [ETH_DEVNET_NODE_URL],
    },
    public: {
      http: [ETH_DEVNET_NODE_URL],
    },
  },
};

export const eth2Devnet: Chain = {
  id: 1397,
  name: 'Ethereum 2 Devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [ETH2_DEVNET_NODE_URL],
    },
    public: {
      http: [ETH2_DEVNET_NODE_URL],
    },
  },
};
