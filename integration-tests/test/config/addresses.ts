import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Address } from 'viem';

// Chain IDs for the different networks
const CHAIN_IDS = {
  HUB: 1337, // EthDevnet1 (Hub)
  SPOKE: 1397, // EthDevnet2 (Spoke)
} as const;

// Type for Node.js file system errors
type NodeError = {
  code: string;
  message: string;
  errno: number;
  syscall: string;
  path: string;
};

function getDeploymentAddresses(
  deploymentFile: string,
  chainId: number = CHAIN_IDS.HUB,
) {
  const projectRoot = join(__dirname, '..', '..', '..', '..');

  const artifactPath = join(
    projectRoot,
    'example-cross-chain-governance',
    'evm',
    'broadcast',
    deploymentFile,
    chainId.toString(),
    'run-latest.json',
  );

  try {
    console.log('Attempting to read deployment from:', artifactPath);
    const deployment = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    const addresses: Record<string, Address> = {};

    for (const tx of deployment.transactions) {
      if (tx.contractAddress) {
        addresses[tx.contractName] = tx.contractAddress as Address;
      }
    }

    return addresses;
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      console.error(`Deployment file not found: ${artifactPath}`);
      console.error(
        'Make sure you have run the deployments for both hub and spoke chains',
      );
      console.error(
        `Expected chainIds: Hub=${CHAIN_IDS.HUB}, Spoke=${CHAIN_IDS.SPOKE}`,
      );
      console.error(`Current directory: ${__dirname}`);
      console.error(`Project root: ${projectRoot}`);
    }
    throw error;
  }
}

// Get Hub contract addresses from EthDevnet1 deployment
const hubAddresses = getDeploymentAddresses(
  'DeployHubContractsEthDevnet1.sol',
  CHAIN_IDS.HUB,
);
// Get Spoke contract addresses from EthDevnet2 deployment
const spokeAddresses = getDeploymentAddresses(
  'DeploySpokeContractsEthDevnet2.sol',
  CHAIN_IDS.SPOKE,
);

const ContractAddressesEnum = {
  // Hub contracts (deployed on EthDevnet1)
  HUB_EVM_SPOKE_AGGREGATE_PROPOSER: hubAddresses.HubEvmSpokeAggregateProposer,
  HUB_GOVERNOR: hubAddresses.HubGovernor,
  HUB_MESSAGE_DISPATCHER: hubAddresses.HubMessageDispatcher,
  HUB_VOTE_POOL: hubAddresses.HubVotePool,
  TOKEN: hubAddresses.ERC20VotesFake,
  TIMELOCK_CONTROLLER: hubAddresses.TimelockController,
  HUB_PROPOSAL_METADATA: hubAddresses.HubProposalMetadata,
  HUB_PROPOSAL_EXTENDER: hubAddresses.HubProposalExtender,
  HUB_SOLANA_MESSAGE_DISPATCHER: hubAddresses.HubSolanaMessageDispatcher,
  HUB_SOLANA_SPOKE_VOTE_DECODER: hubAddresses.HubSolanaSpokeVoteDecoder,

  // Spoke contracts (deployed on EthDevnet2)
  SPOKE_VOTE_AGGREGATOR: spokeAddresses.SpokeVoteAggregator,
  SPOKE_MESSAGE_EXECUTOR: spokeAddresses.ERC1967Proxy,
  SPOKE_METADATA_COLLECTOR: spokeAddresses.SpokeMetadataCollector,
  WORMHOLE_CORE: '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550' as const,
} as const;

type AddressesType = typeof ContractAddressesEnum;
type AddressKeys = keyof AddressesType;

export type Addresses = {
  [K in AddressKeys]: Address;
};

// Validate all addresses are defined
for (const [key, value] of Object.entries(ContractAddressesEnum)) {
  if (!value) {
    throw new Error(`Missing address for ${key}`);
  }
}

export { ContractAddressesEnum as ContractAddresses };
