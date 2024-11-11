import { ERC20VotesFakeAbi } from 'abis';
import { getAddress } from 'viem';
import { addressStore } from './config/addresses';
import type { DeployedAddresses } from './config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from './config/chains';
import { createClients } from './config/clients';
import { mineToTimestamp, syncTime } from './helpers';
import {
  deployHubContracts,
  deploySpokeContracts,
} from './helpers/deployment/deployContracts';
import {
  loadDeploymentCache,
  saveDeploymentCache,
} from './helpers/deployment/deploymentCache';
import {
  getWhitelistedProposer,
  handleRegisterSpokeOnAggProposer,
  handleRegisterSpokeOnHubVotePool,
  handleTransferOwnership,
  isSpokeRegisteredOnAggProposer,
  isSpokeRegisteredOnHubVotePool,
  registerWhitelistedProposer,
} from './helpers/governance/registrationHelpers';
import { delegate, mintTokens } from './helpers/token/tokenHelpers';
import { existsSync } from 'fs';

export async function setupTestEnvironment() {
  console.log('\n🚀 Starting test environment setup...');

  // Check if we should skip deployment
  const skipDeployment =
    process.env.SKIP_DEPLOYMENT === 'true' &&
    existsSync('.deployment-cache.json');

  if (skipDeployment) {
    console.log('Using cached deployment...');
    // Load cached deployment
    await loadDeploymentCache();
    // Verify contracts are accessible
    if (await isSetupComplete()) {
      return;
    }
    console.log(
      'Cached deployment verification failed, proceeding with fresh deployment',
    );
  }

  await handleDeployContracts();

  if (await isSetupComplete()) {
    return;
  }

  const { ethClient, ethWallet } = createClients();

  // Mint tokens
  const TOKEN_AMOUNT = 1_000_000_000_000_000_000_000_000n; // 1M tokens
  await mintTokensOnBothChains(TOKEN_AMOUNT);

  // Delegate votes
  await delegateOnBothChains();
  await activateDelegation();

  await Promise.all([
    handleRegisterSpokeOnAggProposer({
      chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
    }),
    handleTransferOwnership({
      contractAddress: addressStore.getAddress('HUB_VOTE_POOL'),
      newOwner: addressStore.getAddress('TIMELOCK_CONTROLLER'),
      wallet: ethWallet,
      client: ethClient,
    }),
  ]);

  await handleRegisterSpokeOnHubVotePool({
    chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  });

  await registerWhitelistedProposer({
    proposerAddress: addressStore.getAddress(
      'HUB_EVM_SPOKE_AGGREGATE_PROPOSER',
    ),
  });

  await syncTime();
  console.log('\n🎉 Test environment setup completed!\n');
}

const activateDelegation = async () => {
  console.log('\n⛓️  Mining blocks to activate delegation...');
  const { ethClient, eth2Client, account } = createClients();
  const [hubBlock, spokeBlock] = await Promise.all([
    ethClient.getBlock(),
    eth2Client.getBlock(),
  ]);

  const ONE_HOUR_IN_SECONDS = 3600n;
  const newTimestamp =
    Math.max(Number(hubBlock.timestamp), Number(spokeBlock.timestamp)) +
    Number(ONE_HOUR_IN_SECONDS);

  // Mine blocks to the new timestamp
  await mineToTimestamp({
    client: ethClient,
    timestamp: BigInt(newTimestamp),
  });

  // Verify voting power
  const votingPower = await ethClient.readContract({
    address: addressStore.getAddress('HUB_VOTING_TOKEN'),
    abi: ERC20VotesFakeAbi,
    functionName: 'getVotes',
    args: [account.address],
  });
  console.log(`   Voting power: ${votingPower}`);
};

const delegateOnBothChains = async () => {
  console.log('\n👥 Delegating votes...');
  const { account } = createClients();
  await Promise.all([
    delegate({ delegatee: account.address, isHub: true }),
    delegate({ delegatee: account.address, isHub: false }),
  ]);
};

const mintTokensOnBothChains = async (amount: bigint) => {
  console.log('\n💰 Minting tokens...');
  const { account } = createClients();
  await Promise.all([
    mintTokens({ recipientAddress: account.address, amount, isHub: true }),
    mintTokens({ recipientAddress: account.address, amount, isHub: false }),
  ]);
};

const handleDeployContracts = async () => {
  // Only try to load cache if not in CI
  const cachedAddresses = !process.env.CI ? loadDeploymentCache() : null;

  if (cachedAddresses) {
    // Use cached addresses
    for (const [key, value] of Object.entries(cachedAddresses)) {
      addressStore.setAddress(key as keyof DeployedAddresses, value);
    }
    return;
  }

  // Deploy new contracts
  await deployHubContracts();
  await deploySpokeContracts();

  // Save deployment cache (skip in CI)
  if (!process.env.CI) {
    saveDeploymentCache(addressStore.getAllAddresses());
  }
};

const isSetupComplete = async () => {
  console.log('\n🔍 Checking if setup is complete...');

  const whitelistedProposer = await getWhitelistedProposer();
  const isWhitelistedProposerCorrect =
    getAddress(whitelistedProposer) ===
    getAddress(addressStore.getAddress('HUB_EVM_SPOKE_AGGREGATE_PROPOSER'));

  const isSpokeRegisteredOnAggProposerCorrect =
    await isSpokeRegisteredOnAggProposer({
      chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
    });

  const isSpokeRegisteredOnHubVotePoolCorrect =
    await isSpokeRegisteredOnHubVotePool({
      chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
      spokeAddress: addressStore.getAddress('SPOKE_VOTE_AGGREGATOR'),
    });

  const isComplete =
    isWhitelistedProposerCorrect &&
    isSpokeRegisteredOnAggProposerCorrect &&
    isSpokeRegisteredOnHubVotePoolCorrect;

  if (isComplete) {
    console.log('✅ Setup is already complete');
  } else {
    console.log('⚠️  Setup is incomplete');
  }

  return isComplete;
};
