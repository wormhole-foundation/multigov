use crate::context::{CONFIG_SEED, VESTING_CONFIG_SEED};
use crate::error::VestingError;
use crate::state::global_config::GlobalConfig;
use crate::state::VestingConfig;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    admin: Signer<'info>,
    #[account(address = global_config.voting_token_mint)]
    mint: Account<'info, Mint>,
    // Initialize a vault for us to store our money in escrow for vesting
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    vault: Account<'info, TokenAccount>,
    // Set a recovery address for recovering surplus funds from the contract
    #[account(
        token::mint = mint,
        token::token_program = token_program
    )]
    recovery: Account<'info, TokenAccount>,
    // Initialize a vesting config for a specific admin, mint and seed
    #[account(
        init,
        payer = admin,
        space = VestingConfig::LEN,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = global_config.bump,
        constraint = global_config.vesting_admin == admin.key()
            @ VestingError::InvalidVestingAdmin
    )]
    global_config: Box<Account<'info, GlobalConfig>>,

    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, seed: u64, bump: u8) -> Result<()> {
        self.config.set_inner(VestingConfig {
            mint: self.mint.key(),
            recovery: self.recovery.key(),
            vested: 0,
            finalized: false,
            seed,
            bump,
        });
        Ok(())
    }
}
