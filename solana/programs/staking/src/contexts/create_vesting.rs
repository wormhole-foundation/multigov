use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::context::{VESTING_BALANCE_SEED, VESTING_CONFIG_SEED, VEST_SEED};
use crate::state::VestingBalance;
use crate::{
    error::VestingError,
    state::{Vesting, VestingConfig},
};

#[derive(Accounts)]
#[instruction(maturation: i64)]
pub struct CreateVesting<'info> {
    #[account(mut)]
    admin: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
        token::token_program = token_program
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = !config.finalized @ VestingError::VestingFinalized, // Vesting cannot be cancelled after vest is finalized
        has_one = admin, // This check is arbitrary, as mint is baked into the PDA
        has_one = mint, // This check is arbitrary, as mint is baked into the PDA
        seeds = [VESTING_CONFIG_SEED.as_bytes(), admin.key().as_ref(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        init,
        payer = admin,
        space = Vesting::INIT_SPACE,
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), vester_ta.key().as_ref(), maturation.to_le_bytes().as_ref()],
        bump
    )]
    vest: Account<'info, Vesting>,
    #[account(
        mut,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester_ta.owner.key().as_ref()],
        bump = vesting_balance.bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> CreateVesting<'info> {
    pub fn create_vesting(&mut self, maturation: i64, amount: u64, bump: u8) -> Result<()> {
        // Add to total vested amount
        self.config.vested = self
            .config
            .vested
            .checked_add(amount)
            .ok_or(VestingError::Overflow)?;

        self.vesting_balance.total_vesting_balance = self
            .vesting_balance
            .total_vesting_balance
            .checked_add(amount)
            .ok_or(VestingError::Overflow)?;

        self.vest.set_inner(Vesting {
            vester_ta: self.vester_ta.key(),
            config: self.config.key(),
            amount,
            maturation,
            bump,
        });

        Ok(())
    }
}
