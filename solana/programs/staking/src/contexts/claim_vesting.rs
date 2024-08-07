use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked}};

use crate::{error::VestingError, state::{Config, Vesting}};

#[derive(Accounts)]
pub struct ClaimVesting<'info> {
    #[account(mut)]
    vester: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = config.finalized == true @ VestingError::VestingUnfinalized,
        seeds = [b"config", config.admin.as_ref(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, Config>,
    #[account(
        mut,
        close = vester,
        constraint = Clock::get()?.unix_timestamp >= vest.maturation @ VestingError::NotFullyVested,
        has_one = vester_ta, // This check is arbitrary, as ATA is baked into the PDA
        has_one = config, // This check is arbitrary, as ATA is baked into the PDA
        seeds = [b"vest", config.key().as_ref(), vester_ta.key().as_ref(), vest.maturation.to_le_bytes().as_ref()],
        bump = vest.bump
    )]
    vest: Account<'info, Vesting>,    
    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>
}

impl<'info> ClaimVesting<'info> {
    pub fn close_vesting(&mut self) -> Result<()> {
        self.config.vested = self.config.vested.checked_sub(self.vest.amount).ok_or(VestingError::Underflow)?;

        // Binding to solve for lifetime issues
        let seed = self.config.seed.to_le_bytes();
        let bump = [self.config.bump];

        let signer_seeds = [&
            [
                b"config", 
                self.config.admin.as_ref(), 
                self.config.mint.as_ref(), 
                &seed,
                &bump
            ][..]
        ];

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.vault.to_account_info(),
                to: self.vester_ta.to_account_info(),
                mint: self.mint.to_account_info(),
                authority: self.config.to_account_info()
            },
            &signer_seeds
        );

        transfer_checked(ctx, self.vest.amount, self.mint.decimals)
    }
}