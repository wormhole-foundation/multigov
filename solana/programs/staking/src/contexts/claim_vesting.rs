use crate::context::{CONFIG_SEED, VESTING_BALANCE_SEED, VESTING_CONFIG_SEED, VEST_SEED};
use crate::state::checkpoints::{push_checkpoint, CheckpointData, DelegateVotesChanged, Operation};
use crate::state::global_config::GlobalConfig;
use crate::state::stake_account::{RecordedVestingBalanceChanged, StakeAccountMetadata};
use crate::{
    error::{ErrorCode, VestingError},
    state::{Vesting, VestingBalance, VestingConfig},
};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use std::convert::TryInto;

#[event_cpi]
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
        associated_token::mint = mint,
        associated_token::authority = vester,
        associated_token::token_program = token_program
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = config.finalized @ VestingError::VestingUnfinalized,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Account<'info, VestingConfig>,
    #[account(
        mut,
        close = admin,
        constraint = Clock::get()?.unix_timestamp >= vest.maturation @ VestingError::NotFullyVested,
        has_one = vester_ta, // This check is arbitrary, as ATA is baked into the PDA
        has_one = config, // This check is arbitrary, as ATA is baked into the PDA
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), vester_ta.key().as_ref(), vest.maturation.to_le_bytes().as_ref()],
        bump = vest.bump
    )]
    vest: Account<'info, Vesting>,
    #[account(
        mut,
        has_one = vester,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester_ta.owner.key().as_ref()],
        bump = vesting_balance.bump
    )]
    vesting_balance: Account<'info, VestingBalance>,
    /// CheckpointData and StakeAccountMetadata accounts are optional because
    /// in order to be able to claim vests that have not been delegated
    #[account(mut)]
    pub delegate_stake_account_checkpoints: Option<AccountLoader<'info, CheckpointData>>,
    #[account(mut)]
    pub delegate_stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,
    #[account(mut)]
    pub stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = global_config.bump,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,

    /// CHECK: The admin is the refund recipient for the vest account and is checked in the config account constraints
    #[account(mut,
        constraint = global_config.vesting_admin == admin.key()
    )]
    admin: AccountInfo<'info>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CloseVestingEvents {
    pub recorded_vesting_balance_changed: RecordedVestingBalanceChanged,
    pub delegate_votes_changed: DelegateVotesChanged,
}

impl<'info> ClaimVesting<'info> {
    pub fn close_vesting(&mut self) -> Result<Option<CloseVestingEvents>> {
        let mut close_vesting_events = None;
        // If vesting_balance.stake_account_metadata is not set it means that vester has not
        // delegated his vests
        if self.vesting_balance.stake_account_metadata != Pubkey::default() {
            if let (
                Some(stake_account_metadata),
                Some(delegate_stake_account_metadata),
                Some(delegate_stake_account_checkpoints),
            ) = (
                &mut self.stake_account_metadata,
                &mut self.delegate_stake_account_metadata,
                &mut self.delegate_stake_account_checkpoints,
            ) {
                // Check if stake account checkpoints is out of bounds
                let loaded_checkpoints = delegate_stake_account_checkpoints.load()?;
                require!(
                    loaded_checkpoints.next_index
                        < self.global_config.max_checkpoints_account_limit.into(),
                    ErrorCode::TooManyCheckpoints,
                );

                // Verify that the actual delegate_stake_account_checkpoints address matches the expected one
                require!(
                    stake_account_metadata.delegate.key() == loaded_checkpoints.owner,
                    VestingError::InvalidStakeAccountCheckpoints
                );
                drop(loaded_checkpoints);

                // Additional checks to ensure the owner matches
                require!(
                    stake_account_metadata.owner == self.vesting_balance.vester,
                    VestingError::InvalidStakeAccountOwner
                );

                // Verify that the actual delegate_stake_account_metadata address matches the expected one
                require!(
                    stake_account_metadata.delegate == delegate_stake_account_metadata.owner,
                    VestingError::InvalidStakeAccountOwner
                );

                let new_recorded_vesting_balance = stake_account_metadata
                    .recorded_vesting_balance
                    .checked_sub(self.vest.amount)
                    .ok_or(VestingError::Underflow)?;

                // Update the recorded vesting balance
                let recorded_vesting_balance_changed = stake_account_metadata
                    .update_recorded_vesting_balance(new_recorded_vesting_balance);

                // Update checkpoints
                let current_delegate_checkpoints_account_info =
                    delegate_stake_account_checkpoints.to_account_info();

                let current_timestamp: u64 = Clock::get()?.unix_timestamp.try_into()?;

                let delegate_votes_changed = push_checkpoint(
                    delegate_stake_account_checkpoints,
                    &current_delegate_checkpoints_account_info,
                    self.vest.amount,
                    Operation::Subtract,
                    current_timestamp,
                    &self.vester.to_account_info(),
                    &self.system_program.to_account_info(),
                )?;

                let loaded_checkpoints = delegate_stake_account_checkpoints.load()?;
                if loaded_checkpoints.next_index
                    >= self.global_config.max_checkpoints_account_limit.into()
                {
                    if delegate_stake_account_metadata.key() == stake_account_metadata.key() {
                        stake_account_metadata.stake_account_checkpoints_last_index += 1;
                    } else {
                        delegate_stake_account_metadata.stake_account_checkpoints_last_index += 1;
                    }
                }

                close_vesting_events = Some(CloseVestingEvents {
                    recorded_vesting_balance_changed,
                    delegate_votes_changed,
                })
            } else {
                return err!(VestingError::ErrorOfAccountParsing);
            }
        }
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

        // Binding to solve for lifetime issues
        let seed = self.config.seed.to_le_bytes();
        let bump = [self.config.bump];

        let signer_seeds = [&[
            VESTING_CONFIG_SEED.as_bytes(),
            self.config.mint.as_ref(),
            &seed,
            &bump,
        ][..]];

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.vault.to_account_info(),
                to: self.vester_ta.to_account_info(),
                mint: self.mint.to_account_info(),
                authority: self.config.to_account_info(),
            },
            &signer_seeds,
        );

        transfer_checked(ctx, self.vest.amount, self.mint.decimals)?;

        Ok(close_vesting_events)
    }
}
