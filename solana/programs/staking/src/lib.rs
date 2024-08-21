#![deny(unused_must_use)]
#![allow(dead_code)]
#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
// Objects of type Result must be used, otherwise we might
// call a function that returns a Result and not handle the error

use crate::error::ErrorCode;
use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use context::*;
use contexts::*;
use state::global_config::GlobalConfig;
use std::convert::TryInto;

use wormhole_solana_consts::{CORE_BRIDGE_PROGRAM_ID, SOLANA_CHAIN};

use anchor_lang::solana_program::{
    instruction::AccountMeta,
    instruction::Instruction,
    program::invoke_signed
};

// automatically generate module using program idl found in ./idls
declare_program!(wormhole_bridge_core);

mod context;
mod contexts;
mod error;
mod state;
mod utils;
#[cfg(feature = "wasm")]
pub mod wasm;

#[event]
pub struct DelegateChanged {
    pub delegator: Pubkey,
    pub from_delegate: Pubkey,
    pub to_delegate: Pubkey,
}

#[event]
pub struct VoteCast {
    pub voter: Pubkey,
    pub proposal_id: [u8; 32],
    pub weight: u64,
    pub against_votes: u64,
    pub for_votes: u64,
    pub abstain_votes: u64,
}

#[event]
pub struct ProposalCreated {
    pub proposal_id: [u8; 32],
    pub vote_start: u64,
}

declare_id!("5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ");

#[program]
pub mod staking {
    /// Creates a global config for the program
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, global_config: GlobalConfig) -> Result<()> {
        let config_account = &mut ctx.accounts.config_account;
        config_account.bump = ctx.bumps.config_account;
        config_account.governance_authority = global_config.governance_authority;
        config_account.wh_token_mint = global_config.wh_token_mint;
        config_account.freeze = global_config.freeze;
        config_account.pda_authority = global_config.pda_authority;
        config_account.agreement_hash = global_config.agreement_hash;

        #[cfg(feature = "mock-clock")]
        {
            config_account.mock_clock_time = global_config.mock_clock_time;
        }

        Ok(())
    }

    pub fn update_governance_authority(
        ctx: Context<UpdateGovernanceAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.governance_authority = new_authority;
        Ok(())
    }

    pub fn update_pda_authority(
        ctx: Context<UpdatePdaAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.pda_authority = new_authority;
        Ok(())
    }

    pub fn update_agreement_hash(
        ctx: Context<UpdateAgreementHash>,
        agreement_hash: [u8; 32],
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.agreement_hash = agreement_hash;
        Ok(())
    }

    /// Trustless instruction that creates a stake account for a user
    #[inline(never)]
    pub fn create_stake_account(ctx: Context<CreateStakeAccount>, owner: Pubkey) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        stake_account_metadata.initialize(
            ctx.bumps.stake_account_metadata,
            ctx.bumps.stake_account_custody,
            ctx.bumps.custody_authority,
            &owner,
        );

        let stake_account_checkpoints = &mut ctx.accounts.stake_account_checkpoints.load_init()?;
        stake_account_checkpoints.initialize(&owner);

        Ok(())
    }

    pub fn delegate(ctx: Context<Delegate>, delegatee: Pubkey) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;

        if let Some(vesting_balance) = &ctx.accounts.vesting_balance {
            stake_account_metadata.recorded_vesting_balance = vesting_balance.total_vesting_balance;
        } else {
            stake_account_metadata.recorded_vesting_balance = 0;
        }

        let current_delegate = stake_account_metadata.delegate;
        stake_account_metadata.delegate = delegatee;

        emit!(DelegateChanged {
            delegator: ctx.accounts.stake_account_checkpoints.key(),
            from_delegate: current_delegate,
            to_delegate: delegatee
        });

        let recorded_balance = stake_account_metadata.recorded_balance;
        let recorded_vesting_balance = stake_account_metadata.recorded_vesting_balance;
        let current_stake_balance = &ctx.accounts.stake_account_custody.amount;

        let total_balance = recorded_balance + recorded_vesting_balance;

        let config = &ctx.accounts.config;
        let current_timestamp: u64 = utils::clock::get_current_time(config).try_into().unwrap();

        let delegatee_stake_account_checkpoints = &mut ctx
            .accounts
            .delegatee_stake_account_checkpoints
            .load_mut()?;

        if current_delegate != delegatee {
            if current_delegate != Pubkey::default() {
                let current_delegate_stake_account_checkpoints = &mut ctx
                    .accounts
                    .current_delegate_stake_account_checkpoints
                    .load_mut()?;

                let latest_current_delegate_checkpoint_value =
                    current_delegate_stake_account_checkpoints
                        .latest()?
                        .unwrap_or(0);

                if let Ok((_, _)) = current_delegate_stake_account_checkpoints.push(
                    current_timestamp,
                    latest_current_delegate_checkpoint_value - total_balance,
                ) {};
            }

            if delegatee != Pubkey::default() {
                let latest_delegatee_checkpoint_value =
                    delegatee_stake_account_checkpoints.latest()?.unwrap_or(0);
                if let Ok((_, _)) = delegatee_stake_account_checkpoints.push(
                    current_timestamp,
                    latest_delegatee_checkpoint_value + *current_stake_balance,
                ) {};
            }

            if *current_stake_balance != recorded_balance {
                stake_account_metadata.recorded_balance = *current_stake_balance;
            }
        } else {
            if *current_stake_balance != total_balance {
                let latest_delegatee_checkpoint_value =
                    delegatee_stake_account_checkpoints.latest()?.unwrap_or(0);
                if let Ok((_, _)) = delegatee_stake_account_checkpoints.push(
                    current_timestamp,
                    latest_delegatee_checkpoint_value + *current_stake_balance - total_balance,
                ) {};
                stake_account_metadata.recorded_balance = *current_stake_balance;
            }
        }

        Ok(())
    }

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64) -> Result<()> {
        let stake_account_metadata = &ctx.accounts.stake_account_metadata;

        let destination_account = &ctx.accounts.destination;
        let signer = &ctx.accounts.payer;

        if destination_account.owner != *signer.key {
            return Err(error!(ErrorCode::WithdrawToUnauthorizedAccount));
        }

        transfer(
            CpiContext::from(&*ctx.accounts).with_signer(&[&[
                AUTHORITY_SEED.as_bytes(),
                ctx.accounts.stake_account_checkpoints.key().as_ref(),
                &[stake_account_metadata.authority_bump],
            ]]),
            amount,
        )?;

        ctx.accounts.stake_account_custody.reload()?;

        let recorded_balance = stake_account_metadata.recorded_balance;
        let current_stake_balance = &ctx.accounts.stake_account_custody.amount;

        if stake_account_metadata.delegate != Pubkey::default() {
            let current_delegate_stake_account_checkpoints = &mut ctx
                .accounts
                .current_delegate_stake_account_checkpoints
                .load_mut()?;

            let latest_current_delegate_checkpoint_value =
                current_delegate_stake_account_checkpoints
                    .latest()?
                    .unwrap_or(0);

            let config = &ctx.accounts.config;
            let current_timestamp: u64 = utils::clock::get_current_time(config).try_into().unwrap();

            if let Ok((_, _)) = current_delegate_stake_account_checkpoints.push(
                current_timestamp,
                latest_current_delegate_checkpoint_value - recorded_balance + current_stake_balance,
            ) {};
        }

        ctx.accounts.stake_account_metadata.recorded_balance = *current_stake_balance;

        Ok(())
    }

    pub fn add_proposal(
        ctx: Context<AddProposal>,
        proposal_id: [u8; 32],
        vote_start: u64,
        safe_window: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let _ = proposal.add_proposal(proposal_id, vote_start, safe_window);

        emit!(ProposalCreated {
            proposal_id: proposal_id,
            vote_start: vote_start
        });

        Ok(())
    }

    pub fn cast_vote(
        ctx: Context<CastVote>,
        proposal_id: [u8; 32],
        against_votes: u64,
        for_votes: u64,
        abstain_votes: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        let voter_checkpoints = &mut ctx.accounts.voter_checkpoints.load_mut()?;

        let total_weight =
            utils::voter_votes::get_past_votes(voter_checkpoints, proposal.vote_start)?;

        require!(total_weight.clone() > 0, ErrorCode::NoWeight);

        let proposal_voters_weight_cast = &mut ctx.accounts.proposal_voters_weight_cast;

        // Initialize proposal_voters_weight_cast if it hasn't been initialized yet
        if proposal_voters_weight_cast.value == 0 {
            proposal_voters_weight_cast.initialize(proposal_id, &ctx.accounts.payer.key());
        }

        require!(
            proposal_voters_weight_cast.value <= total_weight.clone(),
            ErrorCode::AllWeightCast
        );

        let new_weight =
            against_votes + for_votes + abstain_votes + proposal_voters_weight_cast.value;

        require!(new_weight <= total_weight, ErrorCode::VoteWouldExceedWeight);

        proposal_voters_weight_cast.set(new_weight);

        proposal.against_votes += against_votes;
        proposal.for_votes += for_votes;
        proposal.abstain_votes += abstain_votes;

        emit!(VoteCast {
            voter: ctx.accounts.voter_checkpoints.key(),
            proposal_id: proposal_id,
            weight: total_weight,
            against_votes: against_votes,
            for_votes: for_votes,
            abstain_votes: abstain_votes
        });

        Ok(())
    }

    /**
     * Accept to join the DAO LLC
     * This must happen before delegate
     * The user signs a hash of the agreement and the program checks that the hash matches the
     * agreement
     */
    pub fn join_dao_llc(ctx: Context<JoinDaoLlc>, _agreement_hash: [u8; 32]) -> Result<()> {
        ctx.accounts.stake_account_metadata.signed_agreement_hash =
            Some(ctx.accounts.config.agreement_hash);
        Ok(())
    }

    /** Recovers a user's `stake account` ownership by transferring ownership
     * from a token account to the `owner` of that token account.
     *
     * This functionality addresses the scenario where a user mistakenly
     * created a stake account using their token account address as the owner.
     */
    pub fn recover_account(ctx: Context<RecoverAccount>) -> Result<()> {
        // Check that there aren't any staked tokens in the account.
        // Transferring accounts with staked tokens might lead to double voting
        require!(
            ctx.accounts.stake_account_metadata.recorded_balance == 0,
            ErrorCode::RecoverWithStake
        );

        let new_owner = ctx.accounts.payer_token_account.owner;

        ctx.accounts.stake_account_metadata.owner = new_owner;

        Ok(())
    }

    //------------------------------------ VESTING ------------------------------------------------
    // Initialize a new Config, setting up a mint, vault and admin
    pub fn initialize_vesting_config(ctx: Context<Initialize>, seed: u64) -> Result<()> {
        ctx.accounts.initialize(seed, ctx.bumps.config)
    }

    // Create a vesting balance account
    pub fn create_vesting_balance(ctx: Context<CreateVestingBalance>) -> Result<()> {
        ctx.accounts
            .create_vesting_balance(ctx.bumps.vesting_balance)
    }

    // Finalize a Config, disabling any further creation or cancellation of Vesting accounts
    pub fn finalize_vesting_config(ctx: Context<Finalize>) -> Result<()> {
        ctx.accounts.finalize()
    }

    // Open a new Vesting account and deposit equivalent vested tokens to vault
    pub fn create_vesting(ctx: Context<CreateVesting>, maturation: i64, amount: u64) -> Result<()> {
        ctx.accounts
            .create_vesting(maturation, amount, ctx.bumps.vest)
    }

    // Claim from and close a Vesting account
    pub fn claim_vesting(ctx: Context<ClaimVesting>) -> Result<()> {
        ctx.accounts.close_vesting()
    }

    // Cancel and close a Vesting account for a non-finalized Config
    pub fn cancel_vesting(ctx: Context<CancelVesting>) -> Result<()> {
        ctx.accounts.cancel_vesting()
    }

    // Allow admin to withdraw surplus tokens in excess of total vested amount
    pub fn withdraw_surplus(ctx: Context<WithdrawSurplus>) -> Result<()> {
        ctx.accounts.withdraw_surplus()
    }

    //------------------------------------ SPOKE MESSAGE EXECUTOR ------------------------------------------------
    // Initialize and setting a spoke message executor
    pub fn initialize_spoke_message_executor(ctx: Context<InitializeSpokeMessageExecutor>, hub_chain_id: u16) -> Result<()> {
        let executor = &mut ctx.accounts.executor;
        executor.bump = ctx.bumps.executor;
        executor.hub_dispatcher = ctx.accounts.hub_dispatcher.key();
        executor.hub_chain_id = hub_chain_id;
        executor.spoke_chain_id = SOLANA_CHAIN;
        executor.wormhole_core = CORE_BRIDGE_PROGRAM_ID;
        executor.airlock = ctx.accounts.airlock.key();
        Ok(())
    }

    pub fn set_message_received(ctx: Context<SetMessageReceived>, _message_hash: [u8; 32]) -> Result<()> {
        let message_received = &mut ctx.accounts.message_received;
        message_received.executed = true;
        Ok(())
    }

    pub fn set_airlock(ctx: Context<SetAirlock>) -> Result<()> {
        let executor = &mut ctx.accounts.executor;

        require!(
            ctx.accounts.payer.key() == executor.airlock,
            ErrorCode::InvalidSpokeAirlock
        );

        executor.airlock = ctx.accounts.airlock.key();
        Ok(())
    }

    //------------------------------------ SPOKE AIRLOCK ------------------------------------------------
    pub fn initialize_spoke_airlock(ctx: Context<InitializeSpokeAirlock>, message_executor: Pubkey) -> Result<()> {
        let airlock = &mut ctx.accounts.airlock;
        airlock.bump = ctx.bumps.airlock;
        airlock.message_executor = message_executor;
        Ok(())
    }

    pub fn execute_operation<'info> (
        ctx: Context<'_, '_, '_, 'info, ExecuteOperation<'info>>,
        cpi_target_program_id: Pubkey,
        instruction_data: Vec<u8>,
        _value: u64,
    ) -> Result<()> {
        let airlock = &ctx.accounts.airlock;
        require!(
            ctx.accounts.payer.key() == airlock.message_executor,
            ErrorCode::InvalidMessageExecutor
        );

        let mut all_account_infos = ctx.accounts.to_account_infos();
        all_account_infos.extend_from_slice(ctx.remaining_accounts);

        let account_metas = all_account_infos.clone()
            .into_iter()
            .map(|account| AccountMeta::new(*account.key, false))
            .collect();

        let instruction = Instruction {
            program_id: cpi_target_program_id,
            accounts: account_metas,
            data: instruction_data,
        };

        let signer_seeds: &[&[&[u8]]] = &[&[b"airlock", &[airlock.bump]]];

        invoke_signed(&instruction, &all_account_infos, signer_seeds)?;

        Ok(())
    }
}
