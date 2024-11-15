import { encodeFunctionData, getAddress } from 'viem';
import { addressStore } from './config/addresses';
import type { DeployedAddresses } from './config/addresses';
import { ETH2_DEVNET_WORMHOLE_CHAIN_ID } from './config/chains';
import { createClients } from './config/clients';
import { createAndExecuteProposalViaHubGovernor, createProposalData, mineToTimestamp, syncTime } from './helpers';
import {
  deployHubContracts,
  deploySpokeContracts,
} from './helpers/deployment/deployContracts';
import { loadDeploymentCache } from './helpers/deployment/deploymentCache';
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
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes/index";
import { queryHubProposalMetadata } from './createProposalOnSpoke/helpers.ts'; 
  
import {getWormholeBridgeData} from "../../solana/app/helpers/wormholeBridgeConfig.ts"
import { WHTokenBalance } from "../../solana/app/whTokenBalance.ts";
import { PerChainQueryRequest, QueryRequest, QueryResponse, SolanaPdaQueryRequest, type QueryProxyQueryResponse, type SolanaPdaEntry } from "@wormhole-foundation/wormhole-query-sdk";
import axios from "axios";
import { formatQueryResponseSignaturesForViem, registerSpokeOnHubVotePool } from "test/helpers/index.ts";
import { Wallet, AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, SOL_RPC_NODE, SOLANA_SPOKE_ADDRESS } from "./proposeFromSpoke/constants.ts";
import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import idl from "../../solana/target/idl/staking.json"
import { ContractAddresses } from './config/addresses';
import { StakeConnection, wasm } from "../../solana/app/StakeConnection.ts";

import type {
  Idl,
} from "@coral-xyz/anchor";

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

import type { Staking } from '../../solana/target/types/staking.ts';
import { CHECKPOINTS_ACCOUNT_LIMIT } from '../../solana/app/constants.ts';

export async function setupTestEnvironment() {
  console.log('\n🚀 Starting test environment setup...');

  // Load cached deployment
  const cachedAddresses = loadDeploymentCache();

  if (cachedAddresses) {
    // Use cached addresses
    for (const [key, value] of Object.entries(cachedAddresses)) {
      addressStore.setAddress(key as keyof DeployedAddresses, value);
    }
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

/*
Create mint, initialize Solana spoke and add metadata collectors
*/
export async function setupTestEnvironmentSolana() {
  const client = new Connection(SOL_RPC_NODE);
  const wallet = new Wallet(DEPLOYER_AUTHORITY_KEYPAIR)
  const provider = new AnchorProvider(client, wallet, {})

  // TODO - check if the Config account already exists. If it does then ignore this.

  // Versions should changed in the IDL that are now incompatiable - https://solana.stackexchange.com/questions/13362/type-solananftanchor-is-missing-the-following-properties-from-type-idl-addr
  const program = new Program(
    idl as unknown as Idl,
    provider,
  ) as unknown as Program<Staking>;
 
  // Check if we have already created the accounts for MultiGov. Checking the creation of the Config account is safe to do this with.
  let checkpointDataAccountPublicKey = PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
    new PublicKey(idl.address)
  )[0];

  var programAccountInfo = await client.getAccountInfo(checkpointDataAccountPublicKey);
  if(programAccountInfo != null){
    console.log("Deployment for Solana already completed")
    return;
  }
  
  const WORMHOLE_TOKEN = await spl.createMint(client, DEPLOYER_AUTHORITY_KEYPAIR, DEPLOYER_AUTHORITY_KEYPAIR.publicKey, null, 9);
  console.log("WH Mint key: ", WORMHOLE_TOKEN.toBase58())

  // TODO - sometimes this fails. May want to add a sleep.
  try {
      // Create the token account 
      await spl.createAssociatedTokenAccount(client, DEPLOYER_AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, DEPLOYER_AUTHORITY_KEYPAIR.publicKey)
      console.log("Created token account")
  }
  catch {
    console.log("Token account already created!") 
  }

  // Get the account
  const fromTokenAccount = await spl.getAssociatedTokenAddressSync(
    WORMHOLE_TOKEN,
    DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
  );

  const TOKEN_AMOUNT = 100 * 10 ** 9; 

  try {
    await spl.mintTo(
      client, 
      DEPLOYER_AUTHORITY_KEYPAIR, 
      WORMHOLE_TOKEN, 
      fromTokenAccount, 
      DEPLOYER_AUTHORITY_KEYPAIR,
      TOKEN_AMOUNT
    ) 

    console.log("Minted WH tokens to user")
  }

  catch {
    console.log("MintTo failed")
  }

  //var tokenAccountData = await spl.getAccount(client, fromTokenAccount);

  const globalConfig = {
    bump: 255,
    governanceAuthority: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    whTokenMint: WORMHOLE_TOKEN,
    vestingAdmin: DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
    maxCheckpointsAccountLimit: CHECKPOINTS_ACCOUNT_LIMIT,
  };

  try {
    await program.methods.initConfig(globalConfig).rpc();
    console.log("Init config successful")
  }
  catch (e){
    console.log("InitConfig failed - likely already been called.")
    console.log(e)
  }

  try {
    // Adding the hub to the Solana spoke
    var address: string = ContractAddresses.HUB_PROPOSAL_METADATA;
    await program.methods
    .initializeSpokeMetadataCollector(
      2,
      hexStringToBytes(address),
    ).rpc();

    console.log("Added EVM spoke to Solana");
  }
  catch (e) {
    console.log("Unable to register EVM hub on Solana spoke or already registered"); 
  }


  // Add spoke to Solana and EVM 
  const { ethClient, eth2Client, ethWallet, account } = createClients();

  // Add the solana spoke to EVM hub
  const solanaSpokeAddress = bs58.decode(idl.address); 

  //registerSpokeOnHubVotePool({"chainId" : 1, "spokeAddress" })
  console.log('\n📝 Registering Solana spoke on HubVotePool...');

  // Owner of the HubEvmSpokeAggregateProposer
  await ethClient.impersonateAccount({
    address: addressStore.getAddress('TIMELOCK_CONTROLLER'),
  });

  console.log(addressStore.getAddress('TIMELOCK_CONTROLLER'), solanaSpokeAddress.toString('hex'))
  const hash = await ethWallet.writeContract({
    account: addressStore.getAddress('TIMELOCK_CONTROLLER'),
    address: ContractAddresses.HUB_VOTE_POOL,
    abi: HubVotePoolAbi,
    functionName: 'registerSpoke',
    args: [1, '0x' + solanaSpokeAddress.toString('hex')],
  });

  await ethClient.stopImpersonatingAccount({
    address: addressStore.getAddress('TIMELOCK_CONTROLLER'),
  });

  await ethClient.waitForTransactionReceipt({ hash });

}

export function hexStringToBytes(hexString: string): number[] {
  if (hexString.length % 2 !== 0) {
    throw new Error("Hex string must have an even length.");
  }

  if(hexString.substring(0,2) == "0x"){
    hexString = hexString.substring(2) 
  }

  const bytes = [];

  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }

  return bytes;
}

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
