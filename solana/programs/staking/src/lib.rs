#![deny(unused_must_use)]
#![allow(dead_code)]
#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
// Objects of type Result must be used, otherwise we might
// call a function that returns a Result and not handle the error

use crate::error::MessageExecutorError;
use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use context::*;
use contexts::*;
use state::checkpoints::{
    find_checkpoint_le, push_checkpoint, push_checkpoint_init, read_checkpoint_at_index, Operation,
};
use std::convert::TryInto;

use wormhole_solana_consts::{CORE_BRIDGE_PROGRAM_ID, SOLANA_CHAIN};

use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

use wormhole_query_sdk::structs::{
    ChainSpecificQuery, ChainSpecificResponse, EthCallData, QueryResponse,
};

use crate::error::{
    ErrorCode, ProposalWormholeMessageError, QueriesSolanaVerifyError, VestingError,
};
use crate::state::GuardianSignatures;
use crate::state::{find_window_length_le, init_window_length, push_new_window_length};

mod context;
mod contexts;
mod error;
mod state;
mod utils;
#[cfg(feature = "wasm")]
pub mod wasm;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, BorshSchema)]
pub struct InitConfigArgs {
    pub max_checkpoints_account_limit: u32,
    pub governance_authority: Pubkey,
    pub voting_token_mint: Pubkey,
    pub vesting_admin: Pubkey,
}

#[event]
pub struct DelegateChanged {
    pub delegator: Pubkey,
    pub from_delegate: Pubkey,
    pub to_delegate: Pubkey,
    pub total_delegated_votes: u64,
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

declare_id!("AFuHPdrQGsW8rNQ4oEFF35sm5fg36gwrxyqjkjKvi6ap");
#[program]
pub mod staking {
    /// Creates a global config for the program
    use super::*;
    use crate::state::MessageReceived;

    pub fn init_config(ctx: Context<InitConfig>, args: InitConfigArgs) -> Result<()> {
        require!(
            args.vesting_admin.key() != Pubkey::default()
                && args.governance_authority.key() != Pubkey::default(),
            ErrorCode::InvalidAuthority
        );
        let config_account = &mut ctx.accounts.config_account;
        config_account.bump = ctx.bumps.config_account;
        config_account.governance_authority = args.governance_authority;
        config_account.voting_token_mint = args.voting_token_mint;
        config_account.vesting_admin = args.vesting_admin;
        // Make sure the caller can't set the checkpoint account limit too high
        // We don't want to be able to fill up a checkpoint account and cause a DoS
        // Solana accounts are 10MB maximum = 10485760 bytes
        // The checkpoint account contains 8 + 32 + 8 = 48 bytes of fixed data
        // Every checkpoint is 8 + 8 = 16 bytes, so we can fit in (10485760 - 48) / 16 = 655,357 checkpoints
        require!(
            args.max_checkpoints_account_limit <= 655_000,
            ErrorCode::InvalidCheckpointAccountLimit
        );
        // Similarly make sure max_checkpoints_account_limit > MAX_VOTE_WEIGHT_WINDOW_LENGTH so we can't have
        // 3 checkpoint accounts fall across a window. We don't mind for our tests
        #[cfg(not(feature = "testing"))]
        {
            require!(args.max_checkpoints_account_limit > state::vote_weight_window_lengths::VoteWeightWindowLengths::MAX_VOTE_WEIGHT_WINDOW_LENGTH as u32,
            ErrorCode::InvalidCheckpointAccountLimit);
        }
        config_account.max_checkpoints_account_limit = args.max_checkpoints_account_limit;
        config_account.pending_governance_authority = None;
        config_account.pending_vesting_admin = None;

        Ok(())
    }

    pub fn update_governance_authority(ctx: Context<UpdateGovernanceAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.pending_governance_authority = Some(ctx.accounts.new_authority.key());
        Ok(())
    }

    pub fn claim_governance_authority(ctx: Context<ClaimGovernanceAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.pending_governance_authority = None;
        config.governance_authority = ctx.accounts.new_authority.key();
        Ok(())
    }

    pub fn update_vesting_admin(ctx: Context<UpdateVestingAdmin>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.pending_vesting_admin = Some(ctx.accounts.new_vesting_admin.key());
        Ok(())
    }

    pub fn claim_vesting_admin(ctx: Context<ClaimVestingAdmin>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.pending_vesting_admin = None;
        config.vesting_admin = ctx.accounts.new_vesting_admin.key();
        Ok(())
    }

    /// Trustless instruction that creates a stake account for a user
    #[inline(never)]
    pub fn create_stake_account(ctx: Context<CreateStakeAccount>) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        let owner = &ctx.accounts.payer.key;

        stake_account_metadata.initialize(
            ctx.bumps.stake_account_metadata,
            ctx.bumps.stake_account_custody,
            ctx.bumps.custody_authority,
            &owner,
            &owner,
            0u16,
        );

        let stake_account_checkpoints = &mut ctx.accounts.stake_account_checkpoints.load_init()?;
        stake_account_checkpoints.initialize(owner);

        Ok(())
    }

    pub fn create_checkpoints(ctx: Context<CreateCheckpoints>) -> Result<()> {
        let mut new_stake_account_checkpoints =
            ctx.accounts.new_stake_account_checkpoints.load_init()?;
        new_stake_account_checkpoints.initialize(&ctx.accounts.stake_account_metadata.owner);
        drop(new_stake_account_checkpoints);

        let current_checkpoints_account_info =
            ctx.accounts.stake_account_checkpoints.to_account_info();

        let checkpoint_data = ctx.accounts.stake_account_checkpoints.load()?;
        let latest_index = checkpoint_data.next_index - 1;
        let checkpoint =
            read_checkpoint_at_index(&current_checkpoints_account_info, latest_index as usize)?;
        let checkpoints_account_info = ctx.accounts.new_stake_account_checkpoints.to_account_info();
        push_checkpoint_init(
            &mut ctx.accounts.new_stake_account_checkpoints,
            &checkpoints_account_info,
            checkpoint.value,
            Operation::Add,
            checkpoint.timestamp,
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
        )?;

        Ok(())
    }

    pub fn delegate(
        ctx: Context<Delegate>,
        delegatee: Pubkey,
        _current_delegate_stake_account_owner: Pubkey,
    ) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        let config = &ctx.accounts.config;

        let delegatee_stake_account_checkpoints =
            ctx.accounts.delegatee_stake_account_checkpoints.load()?;
        let current_delegate_stake_account_checkpoints = ctx
            .accounts
            .current_delegate_stake_account_checkpoints
            .load()?;
        require!(
            delegatee_stake_account_checkpoints.next_index
                < config.max_checkpoints_account_limit.into(),
            ErrorCode::TooManyCheckpoints,
        );
        require!(
            current_delegate_stake_account_checkpoints.next_index
                < config.max_checkpoints_account_limit.into(),
            ErrorCode::TooManyCheckpoints,
        );
        drop(delegatee_stake_account_checkpoints);
        drop(current_delegate_stake_account_checkpoints);

        let prev_recorded_total_balance = stake_account_metadata
            .recorded_balance
            .checked_add(stake_account_metadata.recorded_vesting_balance)
            .unwrap();

        let current_stake_balance = ctx.accounts.stake_account_custody.amount;

        if let Some(vesting_config) = &mut ctx.accounts.vesting_config {
            if vesting_config.finalized {
                if let Some(vesting_balance) = &mut ctx.accounts.vesting_balance {
                    let (expected_vesting_balance_pda, _) = Pubkey::find_program_address(
                        &[
                            VESTING_BALANCE_SEED.as_bytes(),
                            vesting_config.key().as_ref(),
                            stake_account_metadata.owner.as_ref(),
                        ],
                        &crate::ID,
                    );
                    require!(
                        expected_vesting_balance_pda == vesting_balance.key(),
                        VestingError::InvalidVestingBalancePDA
                    );

                    if vesting_balance.stake_account_metadata == Pubkey::default() {
                        vesting_balance.stake_account_metadata = stake_account_metadata.key();

                        let new_recorded_vesting_balance = stake_account_metadata
                            .recorded_vesting_balance
                            .checked_add(vesting_balance.total_vesting_balance)
                            .ok_or(VestingError::Overflow)?;

                        // Update the recorded vesting balance
                        let recorded_vesting_balance_changed = stake_account_metadata
                            .update_recorded_vesting_balance(new_recorded_vesting_balance);
                        emit_cpi!(recorded_vesting_balance_changed);
                    }
                }
            }
        }

        let current_delegate = stake_account_metadata.delegate;
        stake_account_metadata.delegate = delegatee;

        let total_delegated_votes = current_stake_balance
            .checked_add(stake_account_metadata.recorded_vesting_balance)
            .unwrap();

        emit!(DelegateChanged {
            delegator: ctx.accounts.payer.key(),
            from_delegate: current_delegate,
            to_delegate: delegatee,
            total_delegated_votes,
        });

        emit_cpi!(DelegateChanged {
            delegator: ctx.accounts.payer.key(),
            from_delegate: current_delegate,
            to_delegate: delegatee,
            total_delegated_votes,
        });

        let current_timestamp: u64 = utils::clock::get_current_time().try_into().unwrap();

        if current_delegate != delegatee {
            if prev_recorded_total_balance > 0 {
                let current_delegate_checkpoints_account_info = ctx
                    .accounts
                    .current_delegate_stake_account_checkpoints
                    .to_account_info();

                let delegate_votes_changed = push_checkpoint(
                    &mut ctx.accounts.current_delegate_stake_account_checkpoints,
                    &current_delegate_checkpoints_account_info,
                    prev_recorded_total_balance,
                    Operation::Subtract,
                    current_timestamp,
                    &ctx.accounts.payer.to_account_info(),
                    &ctx.accounts.system_program.to_account_info(),
                )?;
                emit_cpi!(delegate_votes_changed);
            }

            if total_delegated_votes > 0 {
                let delegatee_checkpoints_account_info = ctx
                    .accounts
                    .delegatee_stake_account_checkpoints
                    .to_account_info();

                let delegate_votes_changed = push_checkpoint(
                    &mut ctx.accounts.delegatee_stake_account_checkpoints,
                    &delegatee_checkpoints_account_info,
                    total_delegated_votes,
                    Operation::Add,
                    current_timestamp,
                    &ctx.accounts.payer.to_account_info(),
                    &ctx.accounts.system_program.to_account_info(),
                )?;
                emit_cpi!(delegate_votes_changed);
            }
        } else if total_delegated_votes != prev_recorded_total_balance {
            let delegatee_checkpoints_account_info = ctx
                .accounts
                .delegatee_stake_account_checkpoints
                .to_account_info();

            let (amount_delta, operation) = if total_delegated_votes > prev_recorded_total_balance {
                (
                    total_delegated_votes
                        .checked_sub(prev_recorded_total_balance)
                        .unwrap(),
                    Operation::Add,
                )
            } else {
                (
                    prev_recorded_total_balance
                        .checked_sub(total_delegated_votes)
                        .unwrap(),
                    Operation::Subtract,
                )
            };

            let delegate_votes_changed = push_checkpoint(
                &mut ctx.accounts.delegatee_stake_account_checkpoints,
                &delegatee_checkpoints_account_info,
                amount_delta,
                operation,
                current_timestamp,
                &ctx.accounts.payer.to_account_info(),
                &ctx.accounts.system_program.to_account_info(),
            )?;
            emit_cpi!(delegate_votes_changed);
        }

        if current_stake_balance != stake_account_metadata.recorded_balance {
            let recorded_balance_changed =
                stake_account_metadata.update_recorded_balance(current_stake_balance);
            emit_cpi!(recorded_balance_changed);
        }

        let delegatee_stake_account_checkpoints =
            ctx.accounts.delegatee_stake_account_checkpoints.load()?;
        let current_delegate_stake_account_checkpoints = ctx
            .accounts
            .current_delegate_stake_account_checkpoints
            .load()?;

        if ctx.accounts.delegatee_stake_account_checkpoints.key()
            == ctx
                .accounts
                .current_delegate_stake_account_checkpoints
                .key()
        {
            if delegatee_stake_account_checkpoints.next_index
                >= config.max_checkpoints_account_limit.into()
            {
                if ctx.accounts.delegatee_stake_account_metadata.key()
                    == ctx.accounts.stake_account_metadata.key()
                {
                    ctx.accounts
                        .stake_account_metadata
                        .stake_account_checkpoints_last_index += 1;
                } else {
                    ctx.accounts
                        .delegatee_stake_account_metadata
                        .stake_account_checkpoints_last_index += 1;
                }
            }
        } else {
            if delegatee_stake_account_checkpoints.next_index
                >= config.max_checkpoints_account_limit.into()
            {
                if ctx.accounts.delegatee_stake_account_metadata.key()
                    == ctx.accounts.stake_account_metadata.key()
                {
                    ctx.accounts
                        .stake_account_metadata
                        .stake_account_checkpoints_last_index += 1;
                } else {
                    ctx.accounts
                        .delegatee_stake_account_metadata
                        .stake_account_checkpoints_last_index += 1;
                }
            }

            if current_delegate_stake_account_checkpoints.next_index
                >= config.max_checkpoints_account_limit.into()
            {
                if ctx.accounts.current_delegate_stake_account_metadata.key()
                    == ctx.accounts.stake_account_metadata.key()
                {
                    ctx.accounts
                        .stake_account_metadata
                        .stake_account_checkpoints_last_index += 1;
                } else {
                    ctx.accounts
                        .current_delegate_stake_account_metadata
                        .stake_account_checkpoints_last_index += 1;
                }
            }
        }

        Ok(())
    }

    pub fn withdraw_tokens(
        ctx: Context<WithdrawTokens>,
        amount: u64,
        _current_delegate_stake_account_metadata_owner: Pubkey,
        _stake_account_metadata_owner: Pubkey,
    ) -> Result<()> {
        require!(amount != 0, ErrorCode::ZeroWithdrawal);

        let stake_account_metadata = &ctx.accounts.stake_account_metadata;

        let destination_account = &ctx.accounts.destination;
        let signer = &ctx.accounts.payer;

        if destination_account.owner != *signer.key {
            return Err(error!(ErrorCode::WithdrawToUnauthorizedAccount));
        }

        transfer(
            CpiContext::from(&*ctx.accounts).with_signer(&[&[
                AUTHORITY_SEED.as_bytes(),
                ctx.accounts.payer.key().as_ref(),
                &[stake_account_metadata.authority_bump],
            ]]),
            amount,
        )?;

        ctx.accounts.stake_account_custody.reload()?;

        let recorded_balance = &stake_account_metadata.recorded_balance;
        let current_stake_balance = &ctx.accounts.stake_account_custody.amount;

        let config = &ctx.accounts.config;
        let loaded_checkpoints = ctx
            .accounts
            .current_delegate_stake_account_checkpoints
            .load()?;
        require!(
            loaded_checkpoints.next_index < config.max_checkpoints_account_limit.into(),
            ErrorCode::TooManyCheckpoints,
        );
        drop(loaded_checkpoints);

        let current_delegate_account_info = ctx
            .accounts
            .current_delegate_stake_account_checkpoints
            .to_account_info();

        let current_timestamp: u64 = utils::clock::get_current_time().try_into().unwrap();

        let (amount_delta, operation) = if current_stake_balance > recorded_balance {
            (current_stake_balance - recorded_balance, Operation::Add)
        } else {
            (
                recorded_balance - current_stake_balance,
                Operation::Subtract,
            )
        };

        let delegate_votes_changed = push_checkpoint(
            &mut ctx.accounts.current_delegate_stake_account_checkpoints,
            &current_delegate_account_info,
            amount_delta,
            operation,
            current_timestamp,
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
        )?;
        emit_cpi!(delegate_votes_changed);

        let loaded_checkpoints = ctx
            .accounts
            .current_delegate_stake_account_checkpoints
            .load()?;
        if loaded_checkpoints.next_index >= config.max_checkpoints_account_limit.into() {
            if ctx.accounts.current_delegate_stake_account_metadata.key()
                != ctx.accounts.stake_account_metadata.key()
            {
                ctx.accounts
                    .current_delegate_stake_account_metadata
                    .stake_account_checkpoints_last_index += 1;
            } else {
                ctx.accounts
                    .stake_account_metadata
                    .stake_account_checkpoints_last_index += 1;
            }
        }
        drop(loaded_checkpoints);

        let recorded_balance_changed = ctx
            .accounts
            .stake_account_metadata
            .update_recorded_balance(*current_stake_balance);
        emit_cpi!(recorded_balance_changed);

        Ok(())
    }

    pub fn cast_vote(
        ctx: Context<CastVote>,
        proposal_id: [u8; 32],
        against_votes: u64,
        for_votes: u64,
        abstain_votes: u64,
        stake_account_checkpoints_index: u16,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let config = &ctx.accounts.config;

        let current_timestamp: u64 = utils::clock::get_current_time().try_into()?;
        let vote_start = proposal.vote_start;
        require!(current_timestamp > vote_start, ErrorCode::ProposalInactive);

        let (_, window_length) = find_window_length_le(
            &ctx.accounts.vote_weight_window_lengths.to_account_info(),
            vote_start,
        )?
        .ok_or(ErrorCode::WindowLengthNotFound)?;

        let window_start = proposal.vote_start - window_length.value;

        // Use the AccountInfo directly from ctx.accounts without storing in a variable
        if let Some((window_start_checkpoint_index, window_start_checkpoint)) = find_checkpoint_le(
            &ctx.accounts.voter_checkpoints.to_account_info(),
            window_start,
        )? {
            // Check if checkpoint is not the last in fully loaded checkpoints account
            require!(
                config.max_checkpoints_account_limit != (window_start_checkpoint_index as u32) + 1,
                ErrorCode::CheckpointOutOfBounds
            );

            let mut total_weight = window_start_checkpoint.value;
            let mut checkpoint_index = window_start_checkpoint_index + 1;
            let mut reading_from_next_account = false;

            // The loop below is guaranteed to exit because:
            // 1. It breaks when there are no more checkpoints in the current or next account.
            // 2. It breaks when a checkpoint's timestamp exceeds the `vote_start` timestamp.
            // This ensures that the loop will not run indefinitely
            loop {
                // We have to skip the last checkpoint in the filled checkpoints account.
                // Instead of the last checkpoint of a filled checkpoints account,
                // we should consider the first checkpoint of the next checkpoints account.
                if !reading_from_next_account
                    && config.max_checkpoints_account_limit == (checkpoint_index as u32) + 1
                {
                    let voter_checkpoints_loader = &ctx.accounts.voter_checkpoints;
                    let voter_checkpoints_data = voter_checkpoints_loader.load()?;
                    if checkpoint_index >= voter_checkpoints_data.next_index as usize {
                        // If the checkpoint account is not completely filled, exit the loop
                        break;
                    }

                    // Switch to the next account

                    // Ensure the next voter checkpoints account exists
                    let voter_checkpoints_next = ctx
                        .accounts
                        .voter_checkpoints_next
                        .as_ref()
                        .ok_or_else(|| error!(ErrorCode::MissingNextCheckpointDataAccount))?;

                    let expected_voter_checkpoints_next_address = Pubkey::find_program_address(
                        &[
                            CHECKPOINT_DATA_SEED.as_bytes(),
                            ctx.accounts.owner.key().as_ref(),
                            (stake_account_checkpoints_index + 1).to_le_bytes().as_ref(),
                        ],
                        &crate::ID,
                    )
                    .0;

                    require!(
                        voter_checkpoints_next.key() == expected_voter_checkpoints_next_address,
                        ErrorCode::InvalidNextVoterCheckpoints
                    );

                    // Reset checkpoint_index for the next account
                    checkpoint_index = 0;
                    // Now reading from the next account
                    reading_from_next_account = true;
                    // Continue to the next iteration to read further checkpoints from the next account
                    continue;
                } else {
                    // Read from the current or next account based on reading_from_next_account
                    let (voter_checkpoints_loader, voter_checkpoints_data) =
                        if reading_from_next_account {
                            let voter_checkpoints_next_loader =
                                ctx.accounts.voter_checkpoints_next.as_ref().unwrap();
                            let voter_checkpoints_next_data =
                                voter_checkpoints_next_loader.load()?;
                            (voter_checkpoints_next_loader, voter_checkpoints_next_data)
                        } else {
                            let voter_checkpoints_loader = &ctx.accounts.voter_checkpoints;
                            let voter_checkpoints_data = voter_checkpoints_loader.load()?;
                            (voter_checkpoints_loader, voter_checkpoints_data)
                        };

                    if checkpoint_index >= voter_checkpoints_data.next_index as usize {
                        // No more checkpoints in account
                        break;
                    }

                    let checkpoint = read_checkpoint_at_index(
                        &voter_checkpoints_loader.to_account_info(),
                        checkpoint_index,
                    )?;

                    if checkpoint.timestamp > vote_start {
                        // Checkpoint is beyond the vote start time
                        break;
                    }

                    if checkpoint.value < total_weight {
                        total_weight = checkpoint.value;
                    }

                    checkpoint_index += 1;
                }
            }

            require!(total_weight > 0, ErrorCode::NoWeight);

            let proposal_voters_weight_cast = &mut ctx.accounts.proposal_voters_weight_cast;

            // Initialize proposal_voters_weight_cast if it hasn't been initialized yet
            if proposal_voters_weight_cast.value == 0 {
                proposal_voters_weight_cast.initialize(proposal_id, &ctx.accounts.owner.key());
            }

            require!(
                proposal_voters_weight_cast.value <= total_weight,
                ErrorCode::AllWeightCast
            );

            let new_weight = against_votes
                .checked_add(for_votes)
                .and_then(|v| v.checked_add(abstain_votes))
                .and_then(|v| v.checked_add(proposal_voters_weight_cast.value))
                .ok_or(ErrorCode::VoteWouldExceedWeight)?;

            require!(new_weight <= total_weight, ErrorCode::VoteWouldExceedWeight);

            proposal_voters_weight_cast.set(new_weight);

            proposal.against_votes = proposal
                .against_votes
                .checked_add(against_votes)
                .ok_or(ErrorCode::GenericOverflow)?;
            proposal.for_votes = proposal
                .for_votes
                .checked_add(for_votes)
                .ok_or(ErrorCode::GenericOverflow)?;
            proposal.abstain_votes = proposal
                .abstain_votes
                .checked_add(abstain_votes)
                .ok_or(ErrorCode::GenericOverflow)?;

            emit!(VoteCast {
                voter: ctx.accounts.owner.key(),
                proposal_id,
                weight: total_weight,
                against_votes,
                for_votes,
                abstain_votes
            });

            emit_cpi!(VoteCast {
                voter: ctx.accounts.owner.key(),
                proposal_id,
                weight: total_weight,
                against_votes,
                for_votes,
                abstain_votes
            });
        } else {
            return Err(error!(ErrorCode::CheckpointNotFound));
        }

        Ok(())
    }

    //------------------------------------ VESTING ------------------------------------------------
    // Initialize a new Config, setting up a mint, vault and admin
    pub fn initialize_vesting_config(ctx: Context<Initialize>, seed: u64) -> Result<()> {
        ctx.accounts.initialize(seed, ctx.bumps.config)
    }

    // Create a new vesting balance account
    pub fn create_vesting_balance(
        ctx: Context<CreateVestingBalance>,
        vester: Pubkey,
    ) -> Result<()> {
        ctx.accounts
            .create_vesting_balance(vester, ctx.bumps.vesting_balance)
    }

    // Closes a vesting balance account
    pub fn close_vesting_balance(ctx: Context<CloseVestingBalance>, _vester: Pubkey) -> Result<()> {
        ctx.accounts.close_vesting_balance()
    }

    // Finalize a Config, disabling any further creation or cancellation of Vesting accounts
    pub fn finalize_vesting_config(ctx: Context<Finalize>) -> Result<()> {
        ctx.accounts.finalize()
    }

    // Open a new Vesting account and deposit equivalent vested tokens to vault
    pub fn create_vesting(
        ctx: Context<CreateVesting>,
        vester: Pubkey,
        maturation: i64,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts
            .create_vesting(vester, maturation, amount, ctx.bumps.vest)
    }

    // Claim from and close a Vesting account
    pub fn claim_vesting(ctx: Context<ClaimVesting>) -> Result<()> {
        let close_vesting_events = ctx.accounts.close_vesting()?;

        if let Some(close_vesting_events) = close_vesting_events {
            emit_cpi!(close_vesting_events.recorded_vesting_balance_changed);
            emit_cpi!(close_vesting_events.delegate_votes_changed);
        }

        Ok(())
    }

    // Transfer vesting to a new vester
    pub fn transfer_vesting(ctx: Context<TransferVesting>, new_vester: Pubkey) -> Result<()> {
        let transfer_vesting_events = ctx.accounts.transfer_vesting(
            new_vester,
            ctx.bumps.new_vest,
            ctx.bumps.new_vesting_balance,
        )?;

        if let Some(stake_account_metadata) = transfer_vesting_events.stake_account_metadata {
            emit_cpi!(stake_account_metadata.recorded_vesting_balance_changed);
            if let Some(delegate_votes_changed) = stake_account_metadata.delegate_votes_changed {
                emit_cpi!(delegate_votes_changed);
            }
        }

        if let Some(new_stake_account_metadata) = transfer_vesting_events.new_stake_account_metadata
        {
            emit_cpi!(new_stake_account_metadata.recorded_vesting_balance_changed);
            if let Some(delegate_votes_changed) = new_stake_account_metadata.delegate_votes_changed
            {
                emit_cpi!(delegate_votes_changed);
            }
        }

        Ok(())
    }

    // Cancel and close a Vesting account for a non-finalized Config
    pub fn cancel_vesting(ctx: Context<CancelVesting>, _vester: Pubkey) -> Result<()> {
        ctx.accounts.cancel_vesting()
    }

    // Allow admin to withdraw surplus tokens in excess of total vested amount
    pub fn withdraw_surplus(ctx: Context<WithdrawSurplus>) -> Result<()> {
        ctx.accounts.withdraw_surplus()
    }

    //------------------------------------ SPOKE MESSAGE EXECUTOR
    //------------------------------------ ------------------------------------------------
    // Initialize and setting a spoke message executor
    pub fn initialize_spoke_message_executor(
        ctx: Context<InitializeSpokeMessageExecutor>,
        hub_chain_id: u16,
    ) -> Result<()> {
        let executor = &mut ctx.accounts.executor;
        executor.bump = ctx.bumps.executor;
        executor.hub_dispatcher = ctx.accounts.hub_dispatcher.key();
        executor.hub_chain_id = hub_chain_id;
        executor.spoke_chain_id = SOLANA_CHAIN;
        executor.wormhole_core = CORE_BRIDGE_PROGRAM_ID;
        Ok(())
    }

    pub fn receive_message(ctx: Context<ReceiveMessage>, max_lamports: u64) -> Result<()> {
        let balance_before = ctx.accounts.payer.lamports();
        let posted_vaa = &ctx.accounts.posted_vaa;

        ctx.accounts.message_received.set_inner(MessageReceived {
            bump: ctx.bumps.message_received,
        });

        require!(
            posted_vaa.payload.1.wormhole_chain_id.clone()
                == ctx.accounts.message_executor.spoke_chain_id.clone(),
            MessageExecutorError::InvalidWormholeChainId
        );

        // Execute the instructions in the message.
        for instruction in posted_vaa.payload.1.instructions.clone() {
            // Prepare AccountInfo vector for the instruction.
            let mut account_infos = vec![];

            for meta in &instruction.accounts {
                let meta_pubkey = Pubkey::new_from_array(meta.pubkey);

                let account_info = ctx
                    .remaining_accounts
                    .iter()
                    .find(|a| a.key == &meta_pubkey)
                    .ok_or_else(|| error!(MessageExecutorError::MissedRemainingAccount))?;
                account_infos.push(account_info.clone());
            }
            // Create the instruction.
            let ix = Instruction {
                program_id: Pubkey::new_from_array(instruction.program_id),
                accounts: instruction
                    .accounts
                    .iter()
                    .map(|meta| {
                        let pubkey = Pubkey::new_from_array(meta.pubkey);
                        if meta.is_signer {
                            if meta.is_writable {
                                AccountMeta::new(pubkey, true)
                            } else {
                                AccountMeta::new_readonly(pubkey, true)
                            }
                        } else if meta.is_writable {
                            AccountMeta::new(pubkey, false)
                        } else {
                            AccountMeta::new_readonly(pubkey, false)
                        }
                    })
                    .collect(),
                data: instruction.data.clone(),
            };

            let signer_seeds: &[&[&[u8]]] =
                &[&[AIRLOCK_SEED.as_bytes(), &[ctx.accounts.airlock.bump]]];

            invoke_signed(&ix, &account_infos, signer_seeds)?;
        }

        let balance_after = ctx.accounts.payer.lamports();
        require!(
            balance_before <= balance_after + max_lamports,
            MessageExecutorError::ExceededMaxLamports
        );

        require!(
            ctx.accounts.payer.owner.key() == ctx.accounts.system_program.key(),
            MessageExecutorError::SignerAccountOwernshipChanged
        );

        Ok(())
    }

    //------------------------------------ SPOKE AIRLOCK
    //------------------------------------ ------------------------------------------------
    pub fn initialize_spoke_airlock(ctx: Context<InitializeSpokeAirlock>) -> Result<()> {
        let airlock = &mut ctx.accounts.airlock;
        airlock.bump = ctx.bumps.airlock;
        Ok(())
    }

    //------------------------------------ SPOKE METADATA COLLECTOR
    //------------------------------------ ------------------------------------------------
    // Initialize and setting a spoke metadata collector
    pub fn initialize_spoke_metadata_collector(
        ctx: Context<InitializeSpokeMetadataCollector>,
        hub_chain_id: u16,
        hub_proposal_metadata: [u8; 20],
    ) -> Result<()> {
        let spoke_metadata_collector = &mut ctx.accounts.spoke_metadata_collector;
        let _ = spoke_metadata_collector.initialize(
            ctx.bumps.spoke_metadata_collector,
            hub_chain_id,
            hub_proposal_metadata,
            CORE_BRIDGE_PROGRAM_ID,
        );

        Ok(())
    }

    pub fn update_hub_proposal_metadata(
        ctx: Context<UpdateHubProposalMetadata>,
        new_hub_proposal_metadata: [u8; 20],
    ) -> Result<()> {
        let spoke_metadata_collector = &mut ctx.accounts.spoke_metadata_collector;

        if spoke_metadata_collector.updates_controlled_by_governance {
            require!(
                ctx.accounts.payer.key() == ctx.accounts.config.governance_authority,
                ErrorCode::NotGovernanceAuthority
            );
        } else {
            require!(
                ctx.accounts.airlock.to_account_info().is_signer,
                ErrorCode::AirlockNotSigner
            );
        }

        let _ = spoke_metadata_collector.update_hub_proposal_metadata(new_hub_proposal_metadata);

        Ok(())
    }

    pub fn relinquish_admin_control_over_hub_proposal_metadata(
        ctx: Context<RelinquishAdminControlOverHubProposalMetadata>,
    ) -> Result<()> {
        let spoke_metadata_collector = &mut ctx.accounts.spoke_metadata_collector;
        spoke_metadata_collector.updates_controlled_by_governance = false;

        Ok(())
    }

    pub fn initialize_vote_weight_window_lengths(
        ctx: Context<InitializeVoteWeightWindowLengths>,
        initial_window_length: u64,
    ) -> Result<()> {
        let vote_weight_window_length = &mut ctx.accounts.vote_weight_window_lengths;

        let mut vote_weight_window_length_data = vote_weight_window_length.load_init()?;
        vote_weight_window_length_data.initialize();
        drop(vote_weight_window_length_data);

        let vote_weight_window_length_account_info = vote_weight_window_length.to_account_info();
        let current_timestamp: u64 = utils::clock::get_current_time().try_into()?;

        init_window_length(
            &vote_weight_window_length_account_info,
            current_timestamp,
            initial_window_length,
        )?;
        Ok(())
    }

    pub fn update_vote_weight_window_lengths(
        ctx: Context<UpdateVoteWeightWindowLengths>,
        new_window_length: u64,
    ) -> Result<()> {
        let vote_weight_window_length = &mut ctx.accounts.vote_weight_window_lengths;
        let vote_weight_window_length_account_info = vote_weight_window_length.to_account_info();
        let current_timestamp: u64 = utils::clock::get_current_time().try_into()?;

        push_new_window_length(
            vote_weight_window_length,
            &vote_weight_window_length_account_info,
            current_timestamp,
            new_window_length,
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
        )?;
        Ok(())
    }

    pub fn post_signatures(
        ctx: Context<PostSignatures>,
        guardian_signatures: Vec<[u8; 66]>,
        total_signatures: u8,
        _random_seed: [u8; 32],
    ) -> Result<()> {
        _post_signatures(ctx, guardian_signatures, total_signatures)
    }

    /// Allows the initial payer to close the signature account in case the query was invalid.
    pub fn close_signatures(_ctx: Context<CloseSignatures>) -> Result<()> {
        Ok(())
    }

    #[access_control(AddProposal::constraints(&ctx, &bytes))]
    pub fn add_proposal(
        ctx: Context<AddProposal>,
        bytes: Vec<u8>,
        proposal_id: [u8; 32],
        _guardian_set_index: u32,
    ) -> Result<()> {
        let response = QueryResponse::deserialize(&bytes)
            .map_err(|_| QueriesSolanaVerifyError::FailedToParseResponse)?;

        require!(
            response.responses.len() == 1,
            ProposalWormholeMessageError::TooManyQueryResponses
        );

        let spoke_metadata_collector = &mut ctx.accounts.spoke_metadata_collector;

        if let ChainSpecificQuery::EthCallWithFinalityQueryRequest(eth_request) =
            &response.request.requests[0].query
        {
            require!(
                eth_request.finality == "finalized",
                ProposalWormholeMessageError::NonFinalizedBlock
            );

            let EthCallData { to, data } = &eth_request.call_data[0];

            require!(
                *to == spoke_metadata_collector.hub_proposal_metadata,
                ProposalWormholeMessageError::InvalidHubProposalMetadataContract
            );

            let proposal_query_request_data =
                spoke_metadata_collector.parse_proposal_query_request_data(data)?;

            // The function signature should be
            // bytes4(keccak256(bytes("getProposalMetadata(uint256)")))
            require!(
                proposal_query_request_data.signature == [0xeb, 0x9b, 0x98, 0x38],
                ProposalWormholeMessageError::InvalidFunctionSignature
            );
        } else {
            return Err(ProposalWormholeMessageError::InvalidChainSpecificQuery.into());
        }

        let response = &response.responses[0];

        require!(
            response.chain_id == spoke_metadata_collector.hub_chain_id,
            ProposalWormholeMessageError::SenderChainMismatch
        );

        if let ChainSpecificResponse::EthCallWithFinalityQueryResponse(eth_response) =
            &response.response
        {
            require!(
                eth_response.results.len() == 1,
                ProposalWormholeMessageError::TooManyEthCallResults
            );

            let proposal_data = spoke_metadata_collector
                .parse_eth_response_proposal_data(&eth_response.results[0])?;

            require!(
                proposal_data.proposal_id == proposal_id,
                ProposalWormholeMessageError::InvalidProposalId
            );

            let proposal = &mut ctx.accounts.proposal;

            require!(
                proposal_data.vote_start != 0,
                ProposalWormholeMessageError::ProposalNotInitialized
            );

            let _ = proposal.add_proposal(proposal_data.proposal_id, proposal_data.vote_start);

            emit!(ProposalCreated {
                proposal_id: proposal_data.proposal_id,
                vote_start: proposal_data.vote_start,
            });

            emit_cpi!(ProposalCreated {
                proposal_id: proposal_data.proposal_id,
                vote_start: proposal_data.vote_start,
            });
        } else {
            return Err(ProposalWormholeMessageError::InvalidChainSpecificResponse.into());
        }

        Ok(())
    }
}

/// Creates or appends to a GuardianSignatures account for subsequent use by verify_query.
/// This is necessary as the Wormhole query response (220 bytes)
/// and 13 guardian signatures (a quorum of the current 19 mainnet guardians, 66 bytes each)
/// alongside the required accounts is larger than the transaction size limit on Solana (1232
/// bytes).
///
/// This instruction allows for the initial payer to append additional signatures to the account by
/// calling the instruction again. This may be necessary if a quorum of signatures from the current
/// guardian set grows larger than can fit into a single transaction.
///
/// The GuardianSignatures account can be closed by anyone with a successful update_root_with_query
/// instruction or by the initial payer via close_signatures, either of which will refund the
/// initial payer.
fn _post_signatures(
    ctx: Context<PostSignatures>,
    mut guardian_signatures: Vec<[u8; 66]>,
    _total_signatures: u8,
) -> Result<()> {
    if ctx.accounts.guardian_signatures.is_initialized() {
        require_eq!(
            ctx.accounts.guardian_signatures.refund_recipient,
            ctx.accounts.payer.key(),
            QueriesSolanaVerifyError::WriteAuthorityMismatch
        );
        ctx.accounts
            .guardian_signatures
            .guardian_signatures
            .append(&mut guardian_signatures);
    } else {
        ctx.accounts
            .guardian_signatures
            .set_inner(GuardianSignatures {
                refund_recipient: ctx.accounts.payer.key(),
                guardian_signatures,
            });
    }

    Ok(())
}
