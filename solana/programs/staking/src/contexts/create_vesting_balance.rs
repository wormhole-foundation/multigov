use crate::context::{CONFIG_SEED, VESTING_BALANCE_SEED, VESTING_CONFIG_SEED};
use crate::error::VestingError;
use crate::state::global_config::GlobalConfig;
use crate::state::{VestingBalance, VestingConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

#[derive(Accounts)]
#[instruction(vester: Pubkey)]
pub struct CreateVestingBalance<'info> {
    #[account(
        mut,
        constraint = global_config.vesting_admin == admin.key()
            @ VestingError::InvalidVestingAdmin
    )]
    admin: Signer<'info>,
    mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        init,
        payer = admin,
        space = VestingBalance::LEN,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester.as_ref()],
        bump
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

impl<'info> CreateVestingBalance<'info> {
    pub fn create_vesting_balance(&mut self, vester: Pubkey, bump: u8) -> Result<()> {
        self.vesting_balance.set_inner(VestingBalance {
            vester,
            stake_account_metadata: Pubkey::default(),
            total_vesting_balance: 0,
            bump,
            rent_payer: self.admin.key(),
        });

        Ok(())
    }
}
