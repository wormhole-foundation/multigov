import { beforeAll, describe, expect, test } from 'bun:test';
import { getAddress, parseEther } from 'viem';
import { ContractAddresses } from './config/addresses';
import { createClients } from './config/clients';
import {
  createProposalOnSpoke,
  getProposalOnSpoke,
} from './createProposalOnSpoke/helpers';
import {
  createAndExecuteCrossChainProposal,
  createTokenMintProposalData,
} from './executeCrossChain/helpers';
import { getVotingTokenBalance } from './helpers';
import {
  createArbitraryProposalData,
  createProposalViaAggregateProposer,
  getProposal,
  waitForProposalToBeActive,
} from './helpers/governance/proposalHelpers';
import { getWhitelistedProposer } from './helpers/governance/registrationHelpers';
import { type ProposalData, ProposalState } from './helpers/governance/types';
import {
  getProposalVotes,
  getVoteStart,
  getVotingPower,
  voteOnProposal,
} from './helpers/governance/votingHelpers';
import { setupTestEnvironment, setupTestEnvironmentSolana } from './setup';
import { voteFromSpoke } from './voteFromSpoke/helpers';
import { createProposalOnSolana, sleep } from './createProposalOnSolana/helpers';
import { StakeConnection } from '../../solana/app/StakeConnection';
import { DEPLOYER_AUTHORITY_KEYPAIR, SOL_RPC_NODE} from './proposeFromSpoke/constants';
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN, Wallet } from '@coral-xyz/anchor';
//import idl from "../solana/target/idl/staking.json"
import idl from "../../solana/target/idl/staking.json"
import { sendVotesToEVMFromSolana, setupVotingOnSolana, voteOnSolana } from './voteFromSolana/helpers';

// Store shared state between tests 1-3
type ProposalTestState = {
  proposalData?: ProposalData;
  hubProposalId?: bigint;
  spokeProposalId?: bigint;
  solanaHubProposalId?: bigint
};

const state: ProposalTestState = {};

describe('MultiGov Tests', () => {
  beforeAll(async () => {
    try {
      await setupTestEnvironment();
      await setupTestEnvironmentSolana();
      console.log('\n🧪 Starting governance flow tests...');
    } catch (error) {
      console.error('\n❌ Test environment setup failed:', error);
      throw error;
    }
  });

  describe('1. Hub Proposal Creation', () => {
    test('Should create proposal on hub', async () => {
      console.log('\n🔍 Testing hub proposal creation...');
      const isWhitelisted = await getWhitelistedProposer();

      expect(isWhitelisted).toBe(
        getAddress(ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER),
      );

      const proposalData = await createArbitraryProposalData();
      state.proposalData = proposalData;

      const proposalId = await createProposalViaAggregateProposer({
        proposalData,
      });
      expect(proposalId).toBeDefined();

      // check it exists in the governor
      const proposal = await getProposal(proposalId);
      expect(proposal).toBeDefined();
      expect(proposal.id).toBe(proposalId);
      expect(proposal.proposer).toBe(
        getAddress(ContractAddresses.HUB_EVM_SPOKE_AGGREGATE_PROPOSER),
      );
      expect(proposal.state).toEqual(ProposalState.Pending);

      state.hubProposalId = proposalId;
    }, 120000);
  });

  describe('2. Spoke Proposal Creation', () => {
    test('Should create proposal on spoke', async () => {
      if (!state.hubProposalId) {
        throw new Error('Hub proposal ID is not set');
      }
      console.log('\n🔍 Testing spoke proposal creation...');
      state.spokeProposalId = await createProposalOnSpoke(state.hubProposalId);
      const spokeProposalData = await getProposalOnSpoke(state.spokeProposalId);
      const hubProposalData = await getProposal(state.hubProposalId);

      expect(spokeProposalData.voteStart).toEqual(
        await getVoteStart({
          proposalId: state.hubProposalId,
          isHub: true,
        }),
      );
      expect(hubProposalData.id).toEqual(state.hubProposalId);
    }, 120000); // Timeout to 2 minutes to allow for query server updates to handle finality
  });

  describe('3. Voting Process', () => {
    test('Should successfully vote from spoke and bridge to hub', async () => {
      if (!state.spokeProposalId) {
        throw new Error('Spoke proposal ID is not set');
      }

      console.log('\n🔍 Testing vote from spoke...');

      await waitForProposalToBeActive(state.spokeProposalId);
      const { account, ethClient } = createClients();

      const voteWeight = await getVotingPower({
        account: account.address,
        isHub: true,
        timestamp: (await ethClient.getBlock()).timestamp,
      });

      const votesBeforeOnHub = await getProposalVotes({
        proposalId: state.spokeProposalId,
        isHub: true,
      });

      await voteFromSpoke(state.spokeProposalId);

      const votesAfterOnHub = await getProposalVotes({
        proposalId: state.spokeProposalId,
        isHub: true,
      });

      expect(votesAfterOnHub.forVotes).toBe(
        votesBeforeOnHub.forVotes + voteWeight,
      );
    }, 120000);
  });
  describe('4. Cross Chain Execution', () => {
    test('Should successfully perform cross-chain token mint', async () => {
      const { eth2Client, account } = createClients();

      const mintAmount = parseEther('1000'); // 1000 tokens (token is 18 decimals)

      const balanceBefore = await getVotingTokenBalance({
        account: account.address,
        client: eth2Client,
        tokenAddress: ContractAddresses.SPOKE_VOTING_TOKEN,
      });

      const proposalData = createTokenMintProposalData({
        recipient: account.address,
        amount: mintAmount,
        tokenAddress: ContractAddresses.SPOKE_VOTING_TOKEN,
      });

      // Create and execute proposal for token minting
      await createAndExecuteCrossChainProposal(proposalData);

      const balanceAfter = await getVotingTokenBalance({
        account: account.address,
        client: eth2Client,
        tokenAddress: ContractAddresses.SPOKE_VOTING_TOKEN,
      });

      // Verify the mint was successful
      expect(balanceAfter).toBe(balanceBefore + mintAmount);
    }, 120000);
  });
  describe("5.Delegate funds on Solana ", async () => {
    test('Should successfully setup voting power on account', async () => {
      const client = new Connection(SOL_RPC_NODE);
      const wallet = new Wallet(DEPLOYER_AUTHORITY_KEYPAIR)

      await setupVotingOnSolana(10000);
      // TODO - check voting power on staking account
      const stakeConnection = await StakeConnection.createStakeConnection(
        client,
        wallet,
        new PublicKey(
            idl.address,
        ),
      );
      // TODO - check amount of tokens and data at a checkpoint address
    },200000);
  });
  describe("6. Create proposal on Solana", async () => {
    test('Should successfully create proposal on Solana', async () => {
      const [proposalId, proposalData] = await createProposalOnSolana();
      state.solanaHubProposalId = proposalId as bigint;

      const proposalIdChanged = Buffer.from((proposalData as any).proposalAccountData.id)
      expect(proposalId.toString(16)).toEqual(proposalIdChanged.toString("hex"));
    }, 500000);
  });
  describe("7. Cast vote on the proposal", async () => {
    test('Successfully vote on a proposal on Solana', async () => {
      const client = new Connection(SOL_RPC_NODE);
      const wallet = new Wallet(DEPLOYER_AUTHORITY_KEYPAIR)

      // For testing - remove later
      //state.solanaHubProposalId = 60855924202326998325098487337070306568540647273636937360343054958449142322956n;
      const bufferProposalId = Buffer.from((state.solanaHubProposalId)?.toString(16), "hex");

      var voteForAmount = 10000;
      await voteOnSolana(bufferProposalId, voteForAmount);
      const stakeConnection = await StakeConnection.createStakeConnection(
        client,
        wallet,
        new PublicKey(
            idl.address,
        ),
      );

      // Need to sleep to allow for query call to return proper data
      var againstVotes, forVotes, abstainVotes;
      var retries = 5; 
      for (var index = 0; index < retries; index++){
        var voteData = await stakeConnection.proposalVotes(Buffer.from(state.solanaHubProposalId?.toString(16), "hex"));

        againstVotes = voteData.againstVotes;
        forVotes = voteData.forVotes;
        abstainVotes = voteData.abstainVotes;

        // Vote has been update or not
        if(forVotes.gt(new BN(0))){
          break; 
        }

        // Sleep to allow enough time
        await sleep(5000 * (index+1));
      }

      expect(forVotes?.toNumber()).toBeGreaterThan(0);
      expect(abstainVotes?.toNumber()).toBe(0);
      expect(againstVotes?.toNumber()).toBe(0);
    },200000);
  });

  describe("8. Send votes to Hub from Solana", async () => {
    test('Send votes to Solana', async () => {
      
      const bufferProposalId = Buffer.from((state.solanaHubProposalId)?.toString(16), "hex");
      const proposalDataBefore = await getProposalVotes({proposalId: state.solanaHubProposalId as bigint, isHub: true}); 

      await sendVotesToEVMFromSolana(bufferProposalId);

      const proposalDataAfter = await getProposalVotes({proposalId: state.solanaHubProposalId as bigint, isHub: true}); 

      expect(proposalDataAfter.forVotes).toBeGreaterThan(proposalDataBefore.forVotes);
    },250000);
  });
});
