import { HubGovernorAbi } from 'abis';
import { ContractAddresses } from './config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from './config/chains';
import { createClients } from './config/clients';
import { syncTime } from './helpers';
import {
  handleRegisterSpokeOnAggProposer,
  handleRegisterSpokeOnHubVotePool,
  handleTransferOwnership,
  registerWhitelistedProposer,
} from './helpers/governance/registrationHelpers';
import { delegate, mintTokens } from './helpers/token/tokenHelpers';

export async function setupTestEnvironment() {
  const { ethClient, eth2Client, ethWallet, account } = createClients();

  // 1. Ensure both chains are at the same block height
  const hubBlock = await ethClient.getBlockNumber();
  const spokeBlock = await eth2Client.getBlockNumber();
  const targetBlock = Math.max(Number(hubBlock), Number(spokeBlock));
  if (hubBlock < targetBlock)
    await ethClient.mine({ blocks: targetBlock - Number(hubBlock) });
  if (spokeBlock < targetBlock)
    await eth2Client.mine({ blocks: targetBlock - Number(spokeBlock) });

  // 2. Mint tokens for the test account on both chains
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

  // 3. Delegate tokens to self
  await delegate({ delegatee: account.address, isHub: true });
  await delegate({ delegatee: account.address, isHub: false });

  // Mine a block to make delegation active
  await ethClient.mine({ blocks: 1 });



  // 4. Register spoke on hub
  await handleRegisterSpokeOnAggProposer({
    chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  });

  // 5. Transfer ownership of HubVotePool to Timelock
  await handleTransferOwnership({
    contractAddress: ContractAddresses.HUB_VOTE_POOL,
    newOwner: ContractAddresses.TIMELOCK_CONTROLLER,
    wallet: ethWallet,
    client: ethClient,
  });

  // 6. Register spoke on HubVotePool
  await handleRegisterSpokeOnHubVotePool({
    chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
  });

  // 7. Register whitelisted proposer (HubEvmSpokeAggregateProposer)
  await registerWhitelistedProposer({
    proposerAddress: ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER,
  });

  await syncTime();
  console.log('Test environment setup completed');
}

export async function teardownTestEnvironment() {
  console.log('Test environment teardown completed');
}
