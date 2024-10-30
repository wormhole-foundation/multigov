use crate::context::VESTING_CONFIG_SEED;
use crate::error::VestingError;
use crate::state::VestingConfig;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked,
    Mint,
    TokenAccount,
    TokenInterface,
    TransferChecked,
};

#[derive(Accounts)]
pub struct WithdrawSurplus<'info> {
    #[account(mut)]
    admin:                    Signer<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program
    )]
    recovery:                 InterfaceAccount<'info, TokenAccount>,
    mint:                     InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    vault:                    InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = vault.amount > config.vested @ VestingError::NotInSurplus,
        has_one = recovery,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), admin.key().as_ref(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config:                   Account<'info, VestingConfig>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_program:            Interface<'info, TokenInterface>,
    system_program:           Program<'info, System>,
}

impl<'info> WithdrawSurplus<'info> {
    pub fn withdraw_surplus(&mut self) -> Result<()> {
        // Binding to solve for lifetime issues
        let seed = self.config.seed.to_le_bytes();
        let bump = [self.config.bump];

        let signer_seeds = [&[
            VESTING_CONFIG_SEED.as_bytes(),
            self.config.admin.as_ref(),
            self.config.mint.as_ref(),
            &seed,
            &bump,
        ][..]];

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from:      self.vault.to_account_info(),
                to:        self.recovery.to_account_info(),
                mint:      self.mint.to_account_info(),
                authority: self.config.to_account_info(),
            },
            &signer_seeds,
        );

        transfer_checked(
            ctx,
            self.vault.amount - self.config.vested,
            self.mint.decimals,
        )
    }
}
