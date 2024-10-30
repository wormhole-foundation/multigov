use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint,
    TokenAccount,
    TokenInterface,
};

use crate::context::{
    VESTING_BALANCE_SEED,
    VESTING_CONFIG_SEED,
    VEST_SEED,
};
use crate::error::VestingError;
use crate::state::{
    Vesting,
    VestingBalance,
    VestingConfig,
};

#[derive(Accounts)]
pub struct CancelVesting<'info> {
    #[account(mut)]
    admin:           Signer<'info>,
    mint:            InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
        token::token_program = token_program
    )]
    vester_ta:       InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = !config.finalized @ VestingError::VestingFinalized, // Vesting cannot be cancelled after vest is finalized
        has_one = admin, // Arbitrary check as admin is baked into the PDA
        has_one = mint, // Arbitrary check as mint is baked into the PDA
        seeds = [VESTING_CONFIG_SEED.as_bytes(), admin.key().as_ref(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config:          Account<'info, VestingConfig>,
    #[account(
        mut,
        close = admin,
        has_one = config, // This check is arbitrary, as ATA is baked into the PDA
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), vest.vester_ta.key().as_ref(), vest.maturation.to_le_bytes().as_ref()],
        bump = vest.bump
    )]
    vest:            Account<'info, Vesting>,
    #[account(
        mut,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester_ta.owner.key().as_ref()],
        bump = vesting_balance.bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    token_program:   Interface<'info, TokenInterface>,
    system_program:  Program<'info, System>,
}

impl<'info> CancelVesting<'info> {
    pub fn cancel_vesting(&mut self) -> Result<()> {
        self.config.vested = self
            .config
            .vested
            .checked_sub(self.vest.amount)
            .ok_or(VestingError::Underflow)?;

        self.vesting_balance.total_vesting_balance = self
            .vesting_balance
            .total_vesting_balance
            .checked_sub(self.vest.amount)
            .ok_or(VestingError::Underflow)?;

        Ok(())
    }
}
