#![deny(unused_must_use)]
#![allow(dead_code)]
#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
// Objects of type Result must be used, otherwise we might
// call a function that returns a Result and not handle the error

use {
    crate::error::ErrorCode,
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
    context::*,
    spl_governance::state::{
        governance::get_governance_data_for_realm,
        proposal::{
            get_proposal_data,
            ProposalV2,
        },
    },
    state::{
        global_config::GlobalConfig,
    },
    std::convert::TryInto,
    utils::{
        clock::{
            get_current_epoch,
            time_to_epoch,
        }
    },
};

mod state;
mod utils;

declare_id!("pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ");
#[program]
pub mod staking {
    /// Creates a global config for the program
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, global_config: GlobalConfig) -> Result<()> {
        let config_account = &mut ctx.accounts.config_account;
        config_account.bump = *ctx.bumps.get("config_account").unwrap();
        config_account.governance_authority = global_config.governance_authority;
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
    pub fn create_stake_account(
        ctx: Context<CreateStakeAccount>,
        owner: Pubkey,
    ) -> Result<()> {
        let config = &ctx.accounts.config;

        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        stake_account_metadata.initialize(
            *ctx.bumps.get("stake_account_metadata").unwrap(),
            *ctx.bumps.get("stake_account_custody").unwrap(),
            *ctx.bumps.get("custody_authority").unwrap(),
            &owner,
        );

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
            ctx.accounts.stake_account_metadata.next_index == 0,
            ErrorCode::RecoverWithStake
        );

        let new_owner = ctx.accounts.payer_token_account.owner;

        ctx.accounts.stake_account_metadata.owner = new_owner;

        Ok(())
    }
}
