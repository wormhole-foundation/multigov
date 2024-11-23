use crate::context::{
    CHECKPOINT_DATA_SEED, CONFIG_SEED, STAKE_ACCOUNT_METADATA_SEED, VESTING_BALANCE_SEED,
    VESTING_CONFIG_SEED, VEST_SEED,
};
use crate::state::checkpoints::{push_checkpoint, CheckpointData, Operation};
use crate::state::global_config::GlobalConfig;
use crate::state::stake_account::StakeAccountMetadata;
use crate::state::{Vesting, VestingBalance, VestingConfig};
use crate::{error::ErrorCode, error::VestingError};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use std::convert::TryInto;

#[derive(Accounts)]
pub struct TransferVesting<'info> {
    #[account(mut)]
    vester: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint
    )]
    vester_ta: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint
    )]
    new_vester_ta: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = config.finalized @ VestingError::VestingUnfinalized,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), global_config.vesting_admin.as_ref(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
        bump = config.bump
    )]
    config: Box<Account<'info, VestingConfig>>,
    #[account(
        mut,
        close = vester,
        has_one = vester_ta, // This check is arbitrary, as ATA is baked into the PDA
        has_one = config, // This check is arbitrary, as ATA is baked into the PDA
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), vester_ta.key().as_ref(), vest.maturation.to_le_bytes().as_ref()],
        bump = vest.bump
    )]
    vest: Box<Account<'info, Vesting>>,
    #[account(
        init_if_needed,
        payer = vester,
        space = Vesting::INIT_SPACE,
        seeds = [VEST_SEED.as_bytes(), config.key().as_ref(), new_vester_ta.key().as_ref(), vest.maturation.to_le_bytes().as_ref()],
        bump
    )]
    new_vest: Box<Account<'info, Vesting>>,
    #[account(
        mut,
        has_one = vester,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), vester_ta.owner.key().as_ref()],
        bump = vesting_balance.bump
    )]
    vesting_balance: Box<Account<'info, VestingBalance>>,
    #[account(
        init_if_needed,
        payer = vester,
        space = VestingBalance::INIT_SPACE,
        seeds = [VESTING_BALANCE_SEED.as_bytes(), config.key().as_ref(), new_vester_ta.owner.key().as_ref()],
        bump
    )]
    new_vesting_balance: Box<Account<'info, VestingBalance>>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = global_config.bump,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
    /// CheckpointData and StakeAccountMetadata accounts are optional because
    /// in order to be able to transfer vests that have not been delegated
    #[account(mut)]
    pub stake_account_checkpoints: Option<AccountLoader<'info, CheckpointData>>,
    #[account(mut)]
    pub stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,
    #[account(mut)]
    pub new_stake_account_checkpoints: Option<AccountLoader<'info, CheckpointData>>,
    #[account(mut)]
    pub new_stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

impl<'info> crate::contexts::TransferVesting<'info> {
    pub fn transfer_vesting(&mut self, bump: u8) -> Result<()> {
        fn update_balance(balance: &mut u64, amount: u64, is_subtract: bool) -> Result<()> {
            if is_subtract {
                *balance = balance.checked_sub(amount).ok_or(VestingError::Underflow)?;
            } else {
                *balance = balance.checked_add(amount).ok_or(VestingError::Underflow)?;
            }
            Ok(())
        }

        if self.new_vester_ta.owner.key() == self.vester_ta.owner.key() {
            return err!(VestingError::TransferVestToMyself);
        }

        if self.vesting_balance.stake_account_metadata != Pubkey::default() {
            if let (Some(stake_account_metadata), Some(stake_account_checkpoints)) = (
                &mut self.stake_account_metadata,
                &mut self.stake_account_checkpoints,
            ) {
                // Check if stake account checkpoints is out of bounds
                let loaded_checkpoints = stake_account_checkpoints.load()?;
                require!(
                    loaded_checkpoints.next_index
                        < self.global_config.max_checkpoints_account_limit.into(),
                    ErrorCode::TooManyCheckpoints,
                );
                drop(loaded_checkpoints);

                // Additional checks to ensure the owner matches
                require!(
                    stake_account_metadata.owner == self.vesting_balance.vester,
                    VestingError::InvalidStakeAccountOwner
                );

                let (expected_stake_account_checkpoints_pda, _) = Pubkey::find_program_address(
                    &[
                        CHECKPOINT_DATA_SEED.as_bytes(),
                        self.vester.key().as_ref(),
                        stake_account_metadata
                            .stake_account_checkpoints_last_index
                            .to_le_bytes()
                            .as_ref(),
                    ],
                    &crate::ID,
                );
                require!(
                    expected_stake_account_checkpoints_pda == stake_account_checkpoints.key(),
                    VestingError::InvalidStakeAccountCheckpointsPDA
                );

                let (expected_stake_account_metadata_pda, _) = Pubkey::find_program_address(
                    &[
                        STAKE_ACCOUNT_METADATA_SEED.as_bytes(),
                        self.vester.key().as_ref(),
                    ],
                    &crate::ID,
                );
                require!(
                    expected_stake_account_metadata_pda == stake_account_metadata.key(),
                    VestingError::InvalidStakeAccountMetadataPDA
                );

                update_balance(
                    &mut stake_account_metadata.recorded_vesting_balance,
                    self.vest.amount,
                    true,
                )?;

                // Update checkpoints
                let current_delegate_checkpoints_account_info =
                    stake_account_checkpoints.to_account_info();

                let current_timestamp: u64 = Clock::get()?.unix_timestamp.try_into()?;

                push_checkpoint(
                    stake_account_checkpoints,
                    &current_delegate_checkpoints_account_info,
                    self.vest.amount,
                    Operation::Subtract,
                    current_timestamp,
                    &self.vester.to_account_info(),
                    &self.system_program.to_account_info(),
                )?;
                let loaded_checkpoints = stake_account_checkpoints.load()?;
                if loaded_checkpoints.next_index
                    >= self.global_config.max_checkpoints_account_limit.into()
                {
                    stake_account_metadata.stake_account_checkpoints_last_index += 1;
                }
            } else {
                return err!(VestingError::ErrorOfStakeAccountParsing);
            }
        }

        if self.new_vesting_balance.stake_account_metadata != Pubkey::default() {
            if let (Some(new_stake_account_metadata), Some(new_stake_account_checkpoints)) = (
                &mut self.new_stake_account_metadata,
                &mut self.new_stake_account_checkpoints,
            ) {
                // Check if stake account checkpoints is out of bounds
                let loaded_checkpoints = new_stake_account_checkpoints.load()?;
                require!(
                    loaded_checkpoints.next_index
                        < self.global_config.max_checkpoints_account_limit.into(),
                    ErrorCode::TooManyCheckpoints,
                );
                drop(loaded_checkpoints);

                require!(
                    new_stake_account_metadata.owner == self.new_vesting_balance.vester,
                    VestingError::InvalidStakeAccountOwner
                );

                let (expected_stake_account_checkpoints_vester_pda, _) =
                    Pubkey::find_program_address(
                        &[
                            CHECKPOINT_DATA_SEED.as_bytes(),
                            self.new_vester_ta.owner.key().as_ref(),
                            new_stake_account_metadata
                                .stake_account_checkpoints_last_index
                                .to_le_bytes()
                                .as_ref(),
                        ],
                        &crate::ID,
                    );

                require!(
                    expected_stake_account_checkpoints_vester_pda
                        == new_stake_account_checkpoints.key(),
                    VestingError::InvalidStakeAccountCheckpointsPDA
                );

                let (expected_stake_account_metadata_vester_pda, _) = Pubkey::find_program_address(
                    &[
                        STAKE_ACCOUNT_METADATA_SEED.as_bytes(),
                        self.new_vester_ta.owner.key().as_ref(),
                    ],
                    &crate::ID,
                );

                require!(
                    expected_stake_account_metadata_vester_pda == new_stake_account_metadata.key(),
                    VestingError::InvalidStakeAccountMetadataPDA
                );

                update_balance(
                    &mut new_stake_account_metadata.recorded_vesting_balance,
                    self.vest.amount,
                    false,
                )?;

                let current_delegate_checkpoints_account_info =
                    new_stake_account_checkpoints.to_account_info();

                let current_timestamp: u64 = Clock::get()?.unix_timestamp.try_into()?;

                push_checkpoint(
                    new_stake_account_checkpoints,
                    &current_delegate_checkpoints_account_info,
                    self.vest.amount,
                    Operation::Add,
                    current_timestamp,
                    &self.vester.to_account_info(),
                    &self.system_program.to_account_info(),
                )?;

                let loaded_checkpoints = new_stake_account_checkpoints.load()?;
                if loaded_checkpoints.next_index
                    >= self.global_config.max_checkpoints_account_limit.into()
                {
                    new_stake_account_metadata.stake_account_checkpoints_last_index += 1;
                }
            } else {
                return err!(VestingError::ErrorOfStakeAccountParsing);
            }
        }

        self.new_vest.set_inner(Vesting {
            vester_ta: self.new_vester_ta.key(),
            config: self.vest.config,
            amount: self.vest.amount,
            maturation: self.vest.maturation,
            bump,
        });

        update_balance(
            &mut self.vesting_balance.total_vesting_balance,
            self.vest.amount,
            true,
        )?;
        update_balance(
            &mut self.new_vesting_balance.total_vesting_balance,
            self.vest.amount,
            false,
        )?;

        Ok(())
    }
}
