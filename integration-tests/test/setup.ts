import { ERC20VotesFakeAbi } from 'abis';
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
  const { ethClient, eth2Client, ethWallet, account } = createClients();

  // Deploy contracts
  await deployHubContracts();
  await deploySpokeContracts();

  // Sync blocks
  await syncBlocks();

  // Mint tokens
  const TOKEN_AMOUNT = 1_000_000_000_000_000_000_000_000n; // 1M tokens
  console.log('\n💰 Minting tokens...');
  await Promise.all([
    mintTokens({
      recipientAddress: account.address,
      amount: TOKEN_AMOUNT,
      isHub: true,
    }),
    mintTokens({
      recipientAddress: account.address,
      amount: TOKEN_AMOUNT,
      isHub: false,
    }),
  ]);

  // Delegate tokens
  console.log('\n📊 Delegating votes...');
  await Promise.all([
    delegate({ delegatee: account.address, isHub: true }),
    delegate({ delegatee: account.address, isHub: false }),
  ]);

  // Mine blocks to make delegation active
  console.log('\n⛓️  Mining blocks to activate delegation...');
  await Promise.all([
    ethClient.mine({ blocks: 2 }),
    eth2Client.mine({ blocks: 2 }),
  ]);

  // Verify voting power
  const votingPower = await ethClient.readContract({
    address: addressStore.getAddress('HUB_VOTING_TOKEN'),
    abi: ERC20VotesFakeAbi,
    functionName: 'getVotes',
    args: [account.address],
  });
  console.log(`   Voting power: ${votingPower}`);

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

  await Promise.all([
    handleRegisterSpokeOnHubVotePool({
      chainId: ETH2_DEVNET_WORMHOLE_CHAIN_ID,
    }),
    await registerWhitelistedProposer({
      proposerAddress: addressStore.getAddress(
        'HUB_EVM_SPOKE_AGGREGATE_PROPOSER',
      ),
    }),
  ]);

  await syncTime();
  console.log('\n🎉 Test environment setup completed!\n');
}
