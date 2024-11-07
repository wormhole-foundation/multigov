import {
  ERC20VotesFakeAbi,
  ERC1967ProxyAbi,
  HubEvmSpokeAggregateProposerAbi,
  HubGovernorAbi,
  HubMessageDispatcherAbi,
  HubVotePoolAbi,
  SpokeMessageExecutorAbi,
  SpokeMetadataCollectorAbi,
  SpokeVoteAggregatorAbi,
  TimelockControllerAbi,
} from 'abis';
import HubProposalExtenderAbi from 'abis/HubProposalExtenderAbi';
import HubProposalMetadataAbi from 'abis/HubProposalMetadataAbi';
import HubSolanaMessageDispatcherAbi from 'abis/HubSolanaMessageDispatcherAbi';
import HubSolanaSpokeVoteDecoderAbi from 'abis/HubSolanaSpokeVoteDecoderAbi';
import {
  ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  ETH_DEVNET_WORMHOLE_CHAIN_ID,
} from 'test/config/chains';
import type { Client, Wallet } from 'test/config/types';
import {
  type Address,
  getContract,
  keccak256,
  parseEther,
  toHex,
  zeroAddress,
} from 'viem';
import { deployContract } from 'viem/actions';
import {
  ERC20VotesFakeBytecode,
  ERC1967ProxyBytecode,
  HubEvmSpokeAggregateProposerBytecode,
  HubGovernorBytecode,
  HubMessageDispatcherBytecode,
  HubProposalExtenderBytecode,
  HubProposalMetadataBytecode,
  HubSolanaMessageDispatcherBytecode,
  HubSolanaSpokeVoteDecoderBytecode,
  HubVotePoolBytecode,
  SpokeMessageExecutorBytecode,
  SpokeMetadataCollectorBytecode,
  SpokeVoteAggregatorBytecode,
  TimelockControllerBytecode,
} from '../../../artifacts';
import { ContractAddresses, addressStore } from '../../config/addresses';
import { createClients } from '../../config/clients';

const PROPOSER_ROLE = keccak256(toHex('PROPOSER_ROLE'));
const EXECUTOR_ROLE = keccak256(toHex('EXECUTOR_ROLE'));
const CANCELLER_ROLE = keccak256(toHex('CANCELLER_ROLE'));
const DEFAULT_ADMIN_ROLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

// High gas limit for large contract deployments
const HIGH_GAS_LIMIT = 30_000_000n;

async function deployToken(wallet: Wallet) {
  const hash = await wallet.deployContract({
    abi: ERC20VotesFakeAbi,
    account: wallet.account,
    bytecode: ERC20VotesFakeBytecode,
  });

  const receipt = await wallet.waitForTransactionReceipt({ hash });
  const token = receipt.contractAddress;

  if (!token) {
    throw new Error('Failed to deploy ERC20VotesFake');
  }

  return token;
}

async function isHubDeployed(client: Client) {
  try {
    // Try to read from HubGovernor contract
    const hubGovernor = getContract({
      abi: HubGovernorAbi,
      address: ContractAddresses.HUB_GOVERNOR,
      client,
    });

    // Try to call a view function
    await hubGovernor.read.name();

    // If we get here, the contract exists and responds
    return true;
  } catch {
    return false;
  }
}

async function isSpokeDeployed(client: Client) {
  try {
    // Try to read from SpokeVoteAggregator contract
    const spokeAggregator = getContract({
      abi: SpokeVoteAggregatorAbi,
      address: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
      client,
    });

    // Try to call a view function
    await spokeAggregator.read.owner();

    return true;
  } catch {
    return false;
  }
}

export async function deployHubContracts() {
  const { ethClient, ethWallet } = createClients();

  // Check if already deployed
  const isDeployed = await isHubDeployed(ethClient);
  if (isDeployed) {
    console.log('Hub contracts already deployed');
    return {
      token: ContractAddresses.HUB_VOTING_TOKEN,
      timelock: ContractAddresses.TIMELOCK_CONTROLLER,
      governor: ContractAddresses.HUB_GOVERNOR,
    };
  }

  console.log('\n🪙  Deploying token...');
  const token = await deployToken(ethWallet);
  console.log(`✅ Token deployed to: ${token}`);
  addressStore.setAddress('HUB_VOTING_TOKEN', token);

  const deploymentConfig = {
    minDelay: 300n,
    name: 'Wormhole EthDevnet1 Governor',
    token: addressStore.getAddress('HUB_VOTING_TOKEN'),
    initialVotingDelay: 90n,
    initialVotingPeriod: 1800n,
    initialProposalThreshold: parseEther('500000'),
    initialQuorum: parseEther('1000000'),
    wormholeCore: addressStore.getAddress('WORMHOLE_CORE'),
    voteWeightWindow: 600n,
    voteExtenderAdmin: ethWallet.account.address,
    voteTimeExtension: 300n,
    minimumExtensionTime: 60n,
    consistencyLevel: 0n,
    initialMaxQueryTimestampOffset: 1800n,
    solanaTokenDecimals: 8n,
  };

  console.log('\n🪙  Deploying TimelockController...');
  // Deploy TimelockController
  const timelockHash = await deployContract(ethClient, {
    abi: TimelockControllerAbi,
    account: ethWallet.account,
    bytecode: TimelockControllerBytecode,
    args: [deploymentConfig.minDelay, [], [], ethWallet.account.address],
    gas: HIGH_GAS_LIMIT,
  });

  const timelockReceipt = await ethClient.waitForTransactionReceipt({
    hash: timelockHash,
  });
  const timelock = timelockReceipt.contractAddress;

  if (!timelock) {
    throw new Error('Failed to deploy TimelockController');
  }

  console.log(`✅ TimelockController deployed to: ${timelock}`);
  addressStore.setAddress('TIMELOCK_CONTROLLER', timelock);

  console.log('\n🪙  Deploying HubProposalExtender...');
  // Deploy HubProposalExtender
  const proposalExtenderHash = await deployContract(ethClient, {
    abi: HubProposalExtenderAbi,
    account: ethWallet.account,
    bytecode: HubProposalExtenderBytecode,
    args: [
      deploymentConfig.voteExtenderAdmin,
      Number(deploymentConfig.voteTimeExtension),
      timelock,
      ethWallet.account.address,
      Number(deploymentConfig.minimumExtensionTime),
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const proposalExtenderReceipt = await ethClient.waitForTransactionReceipt({
    hash: proposalExtenderHash,
  });
  const proposalExtender = proposalExtenderReceipt.contractAddress;

  if (!proposalExtender) {
    throw new Error('Failed to deploy HubProposalExtender');
  }

  addressStore.setAddress('HUB_PROPOSAL_EXTENDER', proposalExtender);

  console.log('\n🪙  Deploying HubVotePool...');
  // Deploy HubVotePool
  const hubVotePoolHash = await deployContract(ethClient, {
    abi: HubVotePoolAbi,
    account: ethWallet.account,
    bytecode: HubVotePoolBytecode,
    args: [
      deploymentConfig.wormholeCore,
      zeroAddress,
      ethWallet.account.address,
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const hubVotePoolReceipt = await ethClient.waitForTransactionReceipt({
    hash: hubVotePoolHash,
  });
  const hubVotePool = hubVotePoolReceipt.contractAddress;

  if (!hubVotePool) {
    throw new Error('Failed to deploy HubVotePool');
  }

  addressStore.setAddress('HUB_VOTE_POOL', hubVotePool);

  console.log('\n🪙  Deploying HubGovernor...');
  // Deploy HubGovernor
  const governorHash = await deployContract(ethClient, {
    abi: HubGovernorAbi,
    account: ethWallet.account,
    bytecode: HubGovernorBytecode,
    args: [
      {
        name: deploymentConfig.name,
        token,
        timelock,
        initialVotingDelay: Number(deploymentConfig.initialVotingDelay),
        initialVotingPeriod: Number(deploymentConfig.initialVotingPeriod),
        initialProposalThreshold: deploymentConfig.initialProposalThreshold,
        initialQuorum: deploymentConfig.initialQuorum,
        hubVotePool,
        wormholeCore: deploymentConfig.wormholeCore,
        governorProposalExtender: addressStore.getAddress(
          'HUB_PROPOSAL_EXTENDER',
        ),
        initialVoteWeightWindow: Number(deploymentConfig.voteWeightWindow),
      },
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const governorReceipt = await ethClient.waitForTransactionReceipt({
    hash: governorHash,
  });
  const governor = governorReceipt.contractAddress as Address;
  addressStore.setAddress('HUB_GOVERNOR', governor);

  console.log('\n🪙  Setting HubGovernor on HubVotePool...');
  // Set the governor on the HubVotePool
  const setGovernorTx = await ethWallet.writeContract({
    abi: HubVotePoolAbi,
    address: hubVotePool,
    functionName: 'setGovernor',
    args: [governor],
    account: ethWallet.account,
  });

  await ethClient.waitForTransactionReceipt({ hash: setGovernorTx });

  console.log('\n🪙  Deploying SolanaSpokeVoteDecoder...');
  // Deploy SolanaSpokeVoteDecoder
  const solanaSpokeVoteDecoderHash = await deployContract(ethClient, {
    abi: HubSolanaSpokeVoteDecoderAbi,
    account: ethWallet.account,
    bytecode: HubSolanaSpokeVoteDecoderBytecode,
    args: [
      deploymentConfig.wormholeCore,
      hubVotePool,
      Number(deploymentConfig.solanaTokenDecimals),
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const solanaSpokeVoteDecoderReceipt =
    await ethClient.waitForTransactionReceipt({
      hash: solanaSpokeVoteDecoderHash,
    });
  const solanaSpokeVoteDecoder = solanaSpokeVoteDecoderReceipt.contractAddress;

  if (!solanaSpokeVoteDecoder) {
    throw new Error('Failed to deploy SolanaSpokeVoteDecoder');
  }

  addressStore.setAddress(
    'HUB_SOLANA_SPOKE_VOTE_DECODER',
    solanaSpokeVoteDecoder,
  );

  console.log('\n🪙  Registering Solana vote decoder...');
  // Register Solana vote decoder
  const registerQueryTypeTx = await ethWallet.writeContract({
    abi: HubVotePoolAbi,
    address: hubVotePool,
    functionName: 'registerQueryType',
    args: [5, solanaSpokeVoteDecoder],
    account: ethWallet.account,
  });

  await ethClient.waitForTransactionReceipt({ hash: registerQueryTypeTx });

  console.log('\n🪙  Deploying HubProposalMetadata...');
  // Deploy HubProposalMetadata
  const hubProposalMetadataHash = await deployContract(ethClient, {
    abi: HubProposalMetadataAbi,
    account: ethWallet.account,
    bytecode: HubProposalMetadataBytecode,
    args: [governor],
    gas: HIGH_GAS_LIMIT,
  });

  const hubProposalMetadataReceipt = await ethClient.waitForTransactionReceipt({
    hash: hubProposalMetadataHash,
  });
  const hubProposalMetadata = hubProposalMetadataReceipt.contractAddress;

  if (!hubProposalMetadata) {
    throw new Error('Failed to deploy HubProposalMetadata');
  }

  addressStore.setAddress('HUB_PROPOSAL_METADATA', hubProposalMetadata);

  console.log('\n🪙  Deploying HubMessageDispatcher...');
  // Deploy HubMessageDispatcher
  const hubMessageDispatcherHash = await deployContract(ethClient, {
    abi: HubMessageDispatcherAbi,
    account: ethWallet.account,
    bytecode: HubMessageDispatcherBytecode,
    args: [
      timelock,
      deploymentConfig.wormholeCore,
      Number(deploymentConfig.consistencyLevel),
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const hubMessageDispatcherReceipt = await ethClient.waitForTransactionReceipt(
    { hash: hubMessageDispatcherHash },
  );
  const hubMessageDispatcher = hubMessageDispatcherReceipt.contractAddress;

  if (!hubMessageDispatcher) {
    throw new Error('Failed to deploy HubMessageDispatcher');
  }

  addressStore.setAddress('HUB_MESSAGE_DISPATCHER', hubMessageDispatcher);

  console.log('\n🪙  Deploying HubSolanaMessageDispatcher...');
  // Deploy HubSolanaMessageDispatcher
  const hubSolanaMessageDispatcherHash = await deployContract(ethClient, {
    abi: HubSolanaMessageDispatcherAbi,
    account: ethWallet.account,
    bytecode: HubSolanaMessageDispatcherBytecode,
    args: [
      timelock,
      deploymentConfig.wormholeCore,
      Number(deploymentConfig.consistencyLevel),
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const hubSolanaMessageDispatcherReceipt =
    await ethClient.waitForTransactionReceipt({
      hash: hubSolanaMessageDispatcherHash,
    });
  const hubSolanaMessageDispatcher =
    hubSolanaMessageDispatcherReceipt.contractAddress;

  if (!hubSolanaMessageDispatcher) {
    throw new Error('Failed to deploy HubSolanaMessageDispatcher');
  }

  addressStore.setAddress(
    'HUB_SOLANA_MESSAGE_DISPATCHER',
    hubSolanaMessageDispatcher,
  );

  console.log('\n🪙  Deploying HubEvmSpokeAggregateProposer...');
  // Deploy HubEvmSpokeAggregateProposer
  const hubEvmSpokeAggregateProposerHash = await deployContract(ethClient, {
    abi: HubEvmSpokeAggregateProposerAbi,
    account: ethWallet.account,
    bytecode: HubEvmSpokeAggregateProposerBytecode,
    args: [
      deploymentConfig.wormholeCore,
      governor,
      Number(deploymentConfig.initialMaxQueryTimestampOffset),
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const hubEvmSpokeAggregateProposerReceipt =
    await ethClient.waitForTransactionReceipt({
      hash: hubEvmSpokeAggregateProposerHash,
    });
  const hubEvmSpokeAggregateProposer =
    hubEvmSpokeAggregateProposerReceipt.contractAddress;

  if (!hubEvmSpokeAggregateProposer) {
    throw new Error('Failed to deploy HubEvmSpokeAggregateProposer');
  }

  addressStore.setAddress(
    'HUB_EVM_SPOKE_AGGREGATE_PROPOSER',
    hubEvmSpokeAggregateProposer,
  );

  console.log('\n🪙  Initializing HubProposalExtender...');
  // Initialize HubProposalExtender
  const initializeProposalExtenderTx = await ethWallet.writeContract({
    abi: HubProposalExtenderAbi,
    address: proposalExtender,
    functionName: 'initialize',
    args: [governor],
    account: ethWallet.account,
  });

  await ethClient.waitForTransactionReceipt({
    hash: initializeProposalExtenderTx,
  });

  // Grant roles
  await grantRoles({ wallet: ethWallet, timelock, governor });

  console.log('\n✅ Hub contracts deployed');
  return {
    token,
    timelock,
    governor,
  };
}

const grantRoles = async ({
  wallet,
  timelock,
  governor,
}: {
  wallet: Wallet;
  timelock: Address;
  governor: Address;
}) => {
  console.log('\n🪙  Granting roles...');
  const [
    grantProposerRoleTx,
    grantExecutorRoleTx,
    grantCancellorRoleTx,
    grantDefaultAdminRoleTx,
    renounceDefaultAdminRoleTx,
  ] = await Promise.all([
    wallet.writeContract({
      abi: TimelockControllerAbi,
      address: timelock,
      functionName: 'grantRole',
      args: [PROPOSER_ROLE, governor],
    }),
    wallet.writeContract({
      abi: TimelockControllerAbi,
      address: timelock,
      functionName: 'grantRole',
      args: [EXECUTOR_ROLE, governor],
    }),
    wallet.writeContract({
      abi: TimelockControllerAbi,
      address: timelock,
      functionName: 'grantRole',
      args: [CANCELLER_ROLE, governor],
    }),
    wallet.writeContract({
      abi: TimelockControllerAbi,
      address: timelock,
      functionName: 'grantRole',
      args: [DEFAULT_ADMIN_ROLE, timelock],
    }),
    wallet.writeContract({
      abi: TimelockControllerAbi,
      address: timelock,
      functionName: 'renounceRole',
      args: [DEFAULT_ADMIN_ROLE, wallet.account.address],
    }),
  ]);

  await Promise.all([
    wallet.waitForTransactionReceipt({ hash: grantProposerRoleTx }),
    wallet.waitForTransactionReceipt({ hash: grantExecutorRoleTx }),
    wallet.waitForTransactionReceipt({ hash: grantCancellorRoleTx }),
    wallet.waitForTransactionReceipt({ hash: grantDefaultAdminRoleTx }),
    wallet.waitForTransactionReceipt({ hash: renounceDefaultAdminRoleTx }),
  ]);

  console.log('\n✅ Hub roles granted');
};

export async function deploySpokeContracts() {
  const { eth2Client, eth2Wallet } = createClients();

  // Check if already deployed
  const isDeployed = await isSpokeDeployed(eth2Client);
  if (isDeployed) {
    console.log('Spoke contracts already deployed');
    return {
      executor: ContractAddresses.SPOKE_MESSAGE_EXECUTOR,
      metadataCollector: ContractAddresses.SPOKE_METADATA_COLLECTOR,
      aggregator: ContractAddresses.SPOKE_VOTE_AGGREGATOR,
    };
  }

  console.log('\n🪙  Deploying Spoke contracts...');

  const deploymentConfig = {
    wormholeCore: addressStore.getAddress('WORMHOLE_CORE'),
    hubChainId: ETH_DEVNET_WORMHOLE_CHAIN_ID,
    hubProposalMetadata: addressStore.getAddress('HUB_PROPOSAL_METADATA'),
    votingToken: addressStore.getAddress('HUB_VOTING_TOKEN'),
    voteWeightWindow: 600n, // 10 minutes
    hubDispatcher: addressStore.getAddress('HUB_MESSAGE_DISPATCHER'),
    spokeChainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  };

  // Deploy token with standard CREATE
  console.log('\n🪙  Deploying Spoke voting token...');
  const token = await deployToken(eth2Wallet);
  addressStore.setAddress('SPOKE_VOTING_TOKEN', token);

  // Deploy SpokeMessageExecutor implementation
  console.log('\n🪙  Deploying SpokeMessageExecutor implementation...');
  const spokeMessageExecutorImplHash = await deployContract(eth2Client, {
    abi: SpokeMessageExecutorAbi,
    account: eth2Wallet.account,
    bytecode: SpokeMessageExecutorBytecode,
    args: [eth2Wallet.account.address],
    gas: HIGH_GAS_LIMIT,
  });

  const spokeMessageExecutorImplReceipt =
    await eth2Client.waitForTransactionReceipt({
      hash: spokeMessageExecutorImplHash,
    });
  const spokeMessageExecutorImpl =
    spokeMessageExecutorImplReceipt.contractAddress;

  if (!spokeMessageExecutorImpl) {
    throw new Error('Failed to deploy SpokeMessageExecutor implementation');
  }

  // Deploy SpokeMessageExecutor proxy
  console.log('\n🪙  Deploying SpokeMessageExecutor proxy...');
  const proxyHash = await deployContract(eth2Client, {
    abi: ERC1967ProxyAbi,
    account: eth2Wallet.account,
    bytecode: ERC1967ProxyBytecode,
    args: [spokeMessageExecutorImpl, '0x'],
  });

  const proxyReceipt = await eth2Client.waitForTransactionReceipt({
    hash: proxyHash,
  });
  const proxy = proxyReceipt.contractAddress;

  if (!proxy) {
    throw new Error('Failed to deploy ERC1967Proxy');
  }

  addressStore.setAddress('SPOKE_MESSAGE_EXECUTOR', proxy);

  console.log('\n🪙  Initializing SpokeMessageExecutor...');
  // Initialize SpokeMessageExecutor
  const initializeTx = await eth2Wallet.writeContract({
    abi: SpokeMessageExecutorAbi,
    address: proxy,
    functionName: 'initialize',
    args: [
      deploymentConfig.hubDispatcher,
      deploymentConfig.hubChainId,
      deploymentConfig.wormholeCore,
    ],
    account: eth2Wallet.account,
  });

  await eth2Client.waitForTransactionReceipt({ hash: initializeTx });

  // Get the airlock address from the executor
  const airlock = await eth2Client.readContract({
    abi: SpokeMessageExecutorAbi,
    address: proxy,
    functionName: 'airlock',
  });

  console.log('\n🪙  Deploying SpokeMetadataCollector...');
  // Deploy SpokeMetadataCollector
  const spokeMetadataCollectorHash = await deployContract(eth2Client, {
    abi: SpokeMetadataCollectorAbi,
    account: eth2Wallet.account,
    bytecode: SpokeMetadataCollectorBytecode,
    args: [
      deploymentConfig.wormholeCore,
      deploymentConfig.hubChainId,
      deploymentConfig.hubProposalMetadata,
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const spokeMetadataCollectorReceipt =
    await eth2Client.waitForTransactionReceipt({
      hash: spokeMetadataCollectorHash,
    });
  const spokeMetadataCollector = spokeMetadataCollectorReceipt.contractAddress;

  if (!spokeMetadataCollector) {
    throw new Error('Failed to deploy SpokeMetadataCollector');
  }

  addressStore.setAddress('SPOKE_METADATA_COLLECTOR', spokeMetadataCollector);

  console.log('\n🪙  Deploying SpokeVoteAggregator...');
  // Deploy SpokeVoteAggregator
  const spokeVoteAggregatorHash = await deployContract(eth2Client, {
    abi: SpokeVoteAggregatorAbi,
    account: eth2Wallet.account,
    bytecode: SpokeVoteAggregatorBytecode,
    args: [
      spokeMetadataCollector,
      addressStore.getAddress('SPOKE_VOTING_TOKEN'),
      airlock,
      Number(deploymentConfig.voteWeightWindow),
    ],
    gas: HIGH_GAS_LIMIT,
  });

  const spokeVoteAggregatorReceipt = await eth2Client.waitForTransactionReceipt(
    {
      hash: spokeVoteAggregatorHash,
    },
  );
  const spokeVoteAggregator = spokeVoteAggregatorReceipt.contractAddress;

  if (!spokeVoteAggregator) {
    throw new Error('Failed to deploy SpokeVoteAggregator');
  }

  addressStore.setAddress('SPOKE_VOTE_AGGREGATOR', spokeVoteAggregator);

  console.log('\n✅ Spoke contracts deployed');

  return {
    executor: proxy,
    metadataCollector: spokeMetadataCollector,
    aggregator: spokeVoteAggregator,
  };
}
