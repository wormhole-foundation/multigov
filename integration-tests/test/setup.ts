import { addressStore } from './config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from './config/chains';
import { createClients } from './config/clients';
import { syncBlocks, syncTime } from './helpers';
import {
  deployHubContracts,
  deploySpokeContracts,
} from './helpers/deployment/deployContracts';
import {
  handleRegisterSpokeOnAggProposer,
  handleRegisterSpokeOnHubVotePool,
  handleTransferOwnership,
  registerWhitelistedProposer,
} from './helpers/governance/registrationHelpers';
import { delegate, mintTokens } from './helpers/token/tokenHelpers';

export async function setupTestEnvironment() {
  console.log('\n🚀 Starting test environment setup...');
  const { ethClient, ethWallet, account } = createClients();

  await deployHubContracts();
  await deploySpokeContracts();
  await syncBlocks();

  // Mint tokens for the test account on both chains
  const tokenAmount = 1000000000000000000000n; // 1000 tokens

  await mintTokens({
    recipientAddress: account.address,
    amount: tokenAmount,
    isHub: true,
  });

  await mintTokens({
    recipientAddress: account.address,
    amount: tokenAmount,
    isHub: false,
  });

  // Delegate tokens to self
  await delegate({ delegatee: account.address, isHub: true });
  await delegate({ delegatee: account.address, isHub: false });

  // Mine a block to make delegation active
  await ethClient.mine({ blocks: 1 });

  // Register spoke on hub
  await handleRegisterSpokeOnAggProposer({
    chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  });

  // Transfer ownership of HubVotePool to Timelock
  await handleTransferOwnership({
    contractAddress: addressStore.getAddress('HUB_VOTE_POOL'),
    newOwner: addressStore.getAddress('TIMELOCK_CONTROLLER'),
    wallet: ethWallet,
    client: ethClient,
  });

  // Register spoke on HubVotePool
  await handleRegisterSpokeOnHubVotePool({
    chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  });

  // Register whitelisted proposer
  await registerWhitelistedProposer({
    proposerAddress: addressStore.getAddress(
      'HUB_EVM_SPOKE_AGGREGATE_PROPOSER',
    ),
  });

  await syncTime();
  console.log('\n🎉 Test environment setup completed!\n');
}

export async function teardownTestEnvironment() {
  console.log('\n🧹 Cleaning up test environment...');
  console.log('✅ Test environment teardown completed\n');
}
