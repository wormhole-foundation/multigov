import type { Address } from 'viem';

// Initial addresses that we know beforehand
export const InitialAddresses = {
  WORMHOLE_CORE: '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550' as const,
} as const;

// Type for deployed contract addresses that will be set during setup
export type DeployedAddresses = {
  // Hub contracts
  HUB_GOVERNOR: Address;
  HUB_MESSAGE_DISPATCHER: Address;
  HUB_VOTE_POOL: Address;
  HUB_VOTING_TOKEN: Address;
  TIMELOCK_CONTROLLER: Address;
  HUB_PROPOSAL_METADATA: Address;
  HUB_PROPOSAL_EXTENDER: Address;
  HUB_EVM_SPOKE_AGGREGATE_PROPOSER: Address;
  HUB_SOLANA_MESSAGE_DISPATCHER: Address;
  HUB_SOLANA_SPOKE_VOTE_DECODER: Address;

  // Spoke contracts
  SPOKE_VOTING_TOKEN: Address;
  SPOKE_VOTE_AGGREGATOR: Address;
  SPOKE_MESSAGE_EXECUTOR: Address;
  SPOKE_METADATA_COLLECTOR: Address;
};

// Create a mutable store for addresses that will be populated during deployment
class AddressStore {
  private static instance: AddressStore;
  private addresses: Partial<DeployedAddresses> & typeof InitialAddresses;

  private constructor() {
    this.addresses = { ...InitialAddresses };
  }

  public static getInstance(): AddressStore {
    if (!AddressStore.instance) {
      AddressStore.instance = new AddressStore();
    }
    return AddressStore.instance;
  }

  public setAddress(key: keyof DeployedAddresses, value: Address) {
    this.addresses[key] = value;
  }

  public getAddress(
    key: keyof DeployedAddresses | keyof typeof InitialAddresses,
  ): Address {
    const address = this.addresses[key];
    if (!address) {
      throw new Error(`Address for ${key} not set`);
    }
    return address;
  }

  public getAllAddresses(): Readonly<
    typeof InitialAddresses & Partial<DeployedAddresses>
  > {
    return { ...this.addresses };
  }
}

export const addressStore = AddressStore.getInstance();

// Export a proxy object that will always return the latest addresses
export const ContractAddresses = new Proxy(
  {} as typeof InitialAddresses & DeployedAddresses,
  {
    get: (_, prop: string) => {
      return addressStore.getAddress(
        prop as keyof (typeof InitialAddresses & DeployedAddresses),
      );
    },
  },
);
