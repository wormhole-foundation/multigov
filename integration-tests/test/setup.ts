import { ERC20VotesFakeAbi } from 'abis';
import { addressStore } from './config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from './config/chains';
import { createClients } from './config/clients';
import { mineToTimestamp, syncTime } from './helpers';
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
  const { ethClient, ethWallet } = createClients();

  // Deploy contracts
  await deployHubContracts();
  await deploySpokeContracts();

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
