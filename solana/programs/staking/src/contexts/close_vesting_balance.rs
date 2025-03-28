use crate::context::{VESTING_BALANCE_SEED, VESTING_CONFIG_SEED};
use crate::error::VestingError;
use crate::state::{VestingBalance, VestingConfig};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

#[derive(Accounts)]
#[instruction(vester: Pubkey)]
pub struct CloseVestingBalance<'info> {
    #[account(mut)]
    /// CHECK: This account is the original rent_payer for the vesting_balance account
    rent_payer: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        mut,
        has_one = rent_payer,
        constraint = vesting_balance.total_vesting_balance == 0 @ VestingError::NotFullyVested,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester.as_ref()],
        bump,
        close = rent_payer,
    )]
    vesting_balance: Account<'info, VestingBalance>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> CloseVestingBalance<'info> {
    pub fn close_vesting_balance(&mut self) -> Result<()> {
        Ok(())
    }
}
