#![deny(unused_must_use)]
#![allow(dead_code)]
#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
// Objects of type Result must be used, otherwise we might
// call a function that returns a Result and not handle the error

use crate::error::ErrorCode;
use anchor_lang::prelude::*;
use context::*;
use state::global_config::GlobalConfig;
use std::convert::TryInto;

mod context;
mod error;
mod state;
mod utils;
#[cfg(feature = "wasm")]
pub mod wasm;

declare_id!("pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ");
#[program]
pub mod staking {
    /// Creates a global config for the program
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, global_config: GlobalConfig) -> Result<()> {
        let config_account = &mut ctx.accounts.config_account;
        config_account.bump = *ctx.bumps.get("config_account").unwrap();
        config_account.governance_authority = global_config.governance_authority;
        config_account.wh_token_mint = global_config.wh_token_mint;
        config_account.wh_governance_realm = global_config.wh_governance_realm;
        config_account.epoch_duration = global_config.epoch_duration;
        config_account.freeze = global_config.freeze;
        config_account.pda_authority = global_config.pda_authority;
        config_account.governance_program = global_config.governance_program;
        config_account.agreement_hash = global_config.agreement_hash;

        #[cfg(feature = "mock-clock")]
        {
            config_account.mock_clock_time = global_config.mock_clock_time;
        }

        if global_config.epoch_duration == 0 {
            return Err(error!(ErrorCode::ZeroEpochDuration));
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
        let config = &ctx.accounts.config;

        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        stake_account_metadata.initialize(
            *ctx.bumps.get("stake_account_metadata").unwrap(),
            *ctx.bumps.get("stake_account_custody").unwrap(),
            *ctx.bumps.get("custody_authority").unwrap(),
            *ctx.bumps.get("voter_weight_record").unwrap(),
            &owner,
        );

        let stake_account_checkpoints = &mut ctx.accounts.stake_account_checkpoints.load_init()?;
        stake_account_checkpoints.initialize(&owner);

        let voter_weight_record = &mut ctx.accounts.voter_weight_record;
        voter_weight_record.initialize(config, &owner);

        Ok(())
    }

    pub fn delegate(ctx: Context<Delegate>, delegatee: Pubkey) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        let current_delegate = stake_account_metadata.delegate;
        stake_account_metadata.delegate = delegatee;

        let recorded_balance = stake_account_metadata.recorded_balance;
        let current_stake_balance = &ctx.accounts.stake_account_custody.amount;

        let config = &ctx.accounts.config;
        let current_timestamp: u64 = utils::clock::get_current_time(config).try_into().unwrap();

        let current_delegate_stake_account_checkpoints = &mut ctx
            .accounts
            .current_delegate_stake_account_checkpoints
            .load_mut()?;
        let delegatee_stake_account_checkpoints = &mut ctx
            .accounts
            .delegatee_stake_account_checkpoints
            .load_mut()?;

        if current_delegate != delegatee {
            if current_delegate != Pubkey::default() {
                let latest_current_delegate_checkpoint_value =
                    current_delegate_stake_account_checkpoints
                        .latest()?
                        .unwrap_or(0);
                if let Ok((_, _)) = current_delegate_stake_account_checkpoints.push(
                    current_timestamp,
                    latest_current_delegate_checkpoint_value - recorded_balance,
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
            if *current_stake_balance != recorded_balance {
                let latest_delegatee_checkpoint_value =
                    delegatee_stake_account_checkpoints.latest()?.unwrap_or(0);
                if let Ok((_, _)) = delegatee_stake_account_checkpoints.push(
                    current_timestamp,
                    latest_delegatee_checkpoint_value + *current_stake_balance - recorded_balance,
                ) {};
                stake_account_metadata.recorded_balance = *current_stake_balance;
            }
        }

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
}
