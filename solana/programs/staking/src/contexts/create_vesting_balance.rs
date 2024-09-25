use crate::context::VESTING_BALANCE_SEED;
use crate::state::VestingBalance;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

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
        seeds = [VESTING_BALANCE_SEED.as_bytes(), vester_ta.owner.key().as_ref()],
        bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    #[account(
        token::mint = mint,
        token::token_program = token_program
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> CreateVestingBalance<'info> {
    pub fn create_vesting_balance(&mut self, bump: u8) -> Result<()> {
        self.vesting_balance.set_inner(VestingBalance {
            vester: self.vester_ta.owner.key(),
            stake_account_metadata: Pubkey::default(),
            total_vesting_balance: 0,
            bump,
        });

        Ok(())
    }
}
