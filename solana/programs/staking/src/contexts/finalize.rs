use crate::context::{VESTING_CONFIG_SEED, CONFIG_SEED};
use crate::error::VestingError;
use crate::state::VestingConfig;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::state::global_config::GlobalConfig;

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(
        mut,
        constraint = global_config.vesting_admin == admin.key()
            @ VestingError::InvalidVestingAdmin
    )]
    pub admin: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = !config.finalized @ VestingError::VestingFinalized,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = global_config.bump,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
    token_program: Interface<'info, TokenInterface>,
}

impl<'info> Finalize<'info> {
    pub fn finalize(&mut self) -> Result<()> {
        require!(
            self.vault.amount == self.config.vested,
            VestingError::VestedBalanceMismatch
        );

        self.config.finalized = true;
        Ok(())
    }
}
