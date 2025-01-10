use crate::context::{VESTING_BALANCE_SEED, VESTING_CONFIG_SEED, CONFIG_SEED};
use crate::state::{VestingBalance, VestingConfig};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::state::global_config::GlobalConfig;
use crate::error::VestingError;

#[derive(Accounts)]
#[instruction()]
pub struct CreateVestingBalance<'info> {
    #[account(
        mut,
        constraint = global_config.vesting_admin == admin.key()
            @ VestingError::InvalidVestingAdmin
    )]
    admin: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        init,
        payer = admin,
        space = VestingBalance::INIT_SPACE,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester_ta.owner.key().as_ref()],
        bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    #[account(
        token::mint = mint,
        token::token_program = token_program
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = global_config.bump,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
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
