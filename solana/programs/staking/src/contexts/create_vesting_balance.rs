use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::state::VestingBalance;

#[derive(Accounts)]
#[instruction()]
pub struct CreateVestingBalance<'info> {
    #[account(mut)]
    admin: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = admin,
        space = VestingBalance::INIT_SPACE,
        seeds = [b"vesting_balance", vester_ta.key().as_ref()],
        bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    #[account(
        token::mint = mint, // Використовуємо mint
        token::token_program = token_program
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>
}

impl<'info> CreateVestingBalance<'info> {
    pub fn create_vesting_balance(&mut self) -> Result<()> {
        self.vesting_balance.set_inner(VestingBalance {
            vester_ta: self.vester_ta.key(),
            total_vesting_balance: 0,
        });

        Ok(())
    }
}
