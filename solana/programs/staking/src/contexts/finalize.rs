use crate::context::VESTING_CONFIG_SEED;
use crate::{error::VestingError, state::VestingConfig};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    // Initialize a vault for us to store our money in escrow for vesting
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    vault: InterfaceAccount<'info, TokenAccount>,
    // Initialize a vesting config for a specific admin, mint and seed
    #[account(
        mut,
        constraint = !config.finalized @ VestingError::VestingFinalized,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), admin.key().as_ref(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    token_program: Interface<'info, TokenInterface>,
}

impl<'info> Finalize<'info> {
    pub fn finalize(&mut self) -> Result<()> {
        self.config.finalized = true;
        Ok(())
    }
}
