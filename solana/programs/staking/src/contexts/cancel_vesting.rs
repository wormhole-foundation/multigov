use crate::context::{CONFIG_SEED, VESTING_BALANCE_SEED, VESTING_CONFIG_SEED, VEST_SEED};
use crate::error::VestingError;
use crate::state::global_config::GlobalConfig;
use crate::state::{Vesting, VestingBalance, VestingConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

#[derive(Accounts)]
#[instruction(vester: Pubkey)]
pub struct CancelVesting<'info> {
    #[account(
        mut,
        constraint = global_config.vesting_admin == admin.key()
            @ VestingError::InvalidVestingAdmin
    )]
    admin: Signer<'info>,
    mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = !config.finalized @ VestingError::VestingFinalized, // Vesting cannot be cancelled after vest is finalized
        has_one = mint, // Arbitrary check as mint is baked into the PDA
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        mut,
        close = admin,
        constraint = vest.vester == vester @ VestingError::InvalidVester,
        has_one = config, // This check is arbitrary, as ATA is baked into the PDA
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), vester.as_ref(), vest.maturation.to_le_bytes().as_ref()],
        bump = vest.bump
    )]
    vest: Account<'info, Vesting>,
    #[account(
        mut,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester.as_ref()],
        bump = vesting_balance.bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = global_config.bump,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
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
