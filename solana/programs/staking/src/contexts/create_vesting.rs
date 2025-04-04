use crate::context::{CONFIG_SEED, VESTING_BALANCE_SEED, VESTING_CONFIG_SEED, VEST_SEED};
use crate::error::VestingError;
use crate::state::global_config::GlobalConfig;
use crate::state::{Vesting, VestingBalance, VestingConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

#[derive(Accounts)]
#[instruction(vester: Pubkey, maturation: i64, _amount: u64)]
pub struct CreateVesting<'info> {
    #[account(
        mut,
        constraint = global_config.vesting_admin == admin.key()
            @ VestingError::InvalidVestingAdmin
    )]
    admin: Signer<'info>,
    mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = !config.finalized @ VestingError::VestingFinalized, // A vest can only be created before a vest is finalized
        has_one = mint, // This check is arbitrary, as mint is baked into the PDA
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        init,
        payer = admin,
        space = Vesting::LEN,
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), vester.as_ref(), maturation.to_le_bytes().as_ref()],
        bump
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

impl<'info> CreateVesting<'info> {
    pub fn create_vesting(
        &mut self,
        vester: Pubkey,
        maturation: i64,
        amount: u64,
        bump: u8,
    ) -> Result<()> {
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
            vester,
            config: self.config.key(),
            amount,
            maturation,
            bump,
        });

        Ok(())
    }
}
