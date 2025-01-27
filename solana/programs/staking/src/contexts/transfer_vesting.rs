use crate::context::{
    CHECKPOINT_DATA_SEED, CONFIG_SEED, STAKE_ACCOUNT_METADATA_SEED, VESTING_BALANCE_SEED,
    VESTING_CONFIG_SEED, VEST_SEED,
};
use crate::state::checkpoints::{push_checkpoint, CheckpointData, DelegateVotesChanged, Operation};
use crate::state::global_config::GlobalConfig;
use crate::state::stake_account::{RecordedVestingBalanceChanged, StakeAccountMetadata};
use crate::state::{Vesting, VestingBalance, VestingConfig};
use crate::{error::ErrorCode, error::VestingError};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[event_cpi]
#[derive(Accounts)]
pub struct TransferVesting<'info> {
    #[account(mut)]
    vester: Signer<'info>,
    mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vester_ta.owner,
        associated_token::token_program = token_program
    )]
    vester_ta: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = new_vester_ta.owner,
        associated_token::token_program = token_program
    )]
    new_vester_ta: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = config.finalized @ VestingError::VestingUnfinalized,
        seeds = [VESTING_CONFIG_SEED.as_bytes(), mint.key().as_ref(), config.seed.to_le_bytes().as_ref()],
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
        space = Vesting::LEN,
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
        space = VestingBalance::LEN,
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
    pub delegate_stake_account_checkpoints: Option<AccountLoader<'info, CheckpointData>>,
    #[account(mut)]
    pub delegate_stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,
    #[account(mut)]
    pub stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,
    #[account(mut)]
    pub new_stake_account_metadata: Option<Box<Account<'info, StakeAccountMetadata>>>,

    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Interface<'info, TokenInterface>,
    system_program: Program<'info, System>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct StakeAccountMetadataEvents {
    pub recorded_vesting_balance_changed: RecordedVestingBalanceChanged,
    pub delegate_votes_changed: Option<DelegateVotesChanged>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct TransferVestingEvents {
    pub stake_account_metadata: Option<StakeAccountMetadataEvents>,
    pub new_stake_account_metadata: Option<StakeAccountMetadataEvents>,
}

impl<'info> crate::contexts::TransferVesting<'info> {
    pub fn transfer_vesting(
        &mut self,
        new_vest_bump: u8,
        new_vesting_balance_bump: u8,
    ) -> Result<TransferVestingEvents> {
        let mut transfer_vesting_events = TransferVestingEvents {
            stake_account_metadata: None,
            new_stake_account_metadata: None,
        };

        // Self transfers are not allowed
        if self.new_vester_ta.owner.key() == self.vester_ta.owner.key() {
            return err!(VestingError::TransferVestToMyself);
        }

        let sender_has_delegated_vest = self.vesting_balance.stake_account_metadata != Pubkey::default();
        let recipient_has_delegated_vest = self.new_vesting_balance.stake_account_metadata != Pubkey::default();

        // There are only 3 valid input account permutations.
        let delegate_votes_changed = match (
            sender_has_delegated_vest,
            recipient_has_delegated_vest,
            &mut self.delegate_stake_account_checkpoints,
            &mut self.delegate_stake_account_metadata,
            &mut self.stake_account_metadata,
            &mut self.new_stake_account_metadata,
        ) {
            // If the sender and recipient have delegated their vests, then we don't need the delegate accounts as we enforce below that the delegates
            // have to be the same. Thus, no there is no net change in delegate voting power and no new checkpoints are needed
            (true, true, None, None, Some(stake_account_metadata), Some(new_stake_account_metadata)) => {
                // The sender must be delegated to the same address as the recipient.
                require!(
                    stake_account_metadata.delegate == new_stake_account_metadata.delegate,
                    VestingError::StakeAccountDelegatesMismatch
                );
                // The sender cannot transfer the vest to the recipient, who has delegated votes to the sender.
                require!(
                    stake_account_metadata.owner != new_stake_account_metadata.delegate,
                    VestingError::StakeAccountDelegationLoop
                );

                // We update the recorded vesting balance of the recipient below. We don't update the recorded vesting balance
                // of the sender here, we instead do it later outside of the match cases

                // Additional checks to ensure the owner matches
                require!(
                    new_stake_account_metadata.owner == self.new_vesting_balance.vester,
                    VestingError::InvalidStakeAccountOwner
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

                let new_recorded_vesting_balance = new_stake_account_metadata
                    .recorded_vesting_balance
                    .checked_add(self.vest.amount)
                    .ok_or(VestingError::Overflow)?;

                let recorded_vesting_balance_changed = new_stake_account_metadata
                    .update_recorded_vesting_balance(new_recorded_vesting_balance);
                let delegate_votes_changed = None;
                transfer_vesting_events.new_stake_account_metadata =
                    Some(StakeAccountMetadataEvents {
                        recorded_vesting_balance_changed,
                        delegate_votes_changed
                    });
                
                Ok(None)
            },
            // If the sender has delegated their vest, but the recipient hasn't then all bar the new_stake_account_metadata account must be provided
            (true, false, Some(delegate_stake_account_checkpoints), Some(delegate_stake_account_metadata), Some(stake_account_metadata), None) => {
                // In this case the current delegate will have their voting balance reduced. That's what we do below.
                // We don't update the recorded vesting balance of the sender here, we instead do it later outside of the match cases
                
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

                // Verify that the actual delegate_stake_account_metadata address matches the expected one
                require!(
                    stake_account_metadata.delegate == delegate_stake_account_metadata.owner,
                    VestingError::InvalidDelegateStakeAccountOwner
                );

                let (expected_delegate_stake_account_checkpoints_pda, _) =
                    Pubkey::find_program_address(
                        &[
                            CHECKPOINT_DATA_SEED.as_bytes(),
                            stake_account_metadata.delegate.key().as_ref(),
                            delegate_stake_account_metadata
                                .stake_account_checkpoints_last_index
                                .to_le_bytes()
                                .as_ref(),
                        ],
                        &crate::ID,
                    );
                require!(
                    expected_delegate_stake_account_checkpoints_pda
                        == delegate_stake_account_checkpoints.key(),
                    VestingError::InvalidStakeAccountCheckpointsPDA
                );

                // Update checkpoints
                let delegate_checkpoints_account_info =
                    delegate_stake_account_checkpoints.to_account_info();

                let current_timestamp: u64 = Clock::get()?.unix_timestamp.try_into()?;

                let delegate_votes_changed = Some(push_checkpoint(
                    delegate_stake_account_checkpoints,
                    &delegate_checkpoints_account_info,
                    self.vest.amount,
                    Operation::Subtract,
                    current_timestamp,
                    &self.vester.to_account_info(),
                    &self.system_program.to_account_info(),
                )?);
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

                Ok(delegate_votes_changed)
            },
            // If neither the sender or receiver has delegated their vests, then none of the optional accounts are needed
            // No changes need to be made to any accounts apart from the vesting balance accounts
            (false, false, None, None, None, None) => { Ok(None) },
            // Any other combination is invalid
            _ => err!(VestingError::ErrorOfAccountParsing),
        }?;

        // This can be true in 2 of the above cases, so we do it here to avoid code duplication
        if sender_has_delegated_vest {
            // We are guaranteed to have the stake_account_metadata account here now, so we can just unwrap directly
            let stake_account_metadata = self.stake_account_metadata.as_mut().unwrap();
            // Additional checks to ensure the owner matches
            require!(
                stake_account_metadata.owner == self.vesting_balance.vester,
                VestingError::InvalidStakeAccountOwner
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

            let new_recorded_vesting_balance = stake_account_metadata
                .recorded_vesting_balance
                .checked_sub(self.vest.amount)
                .ok_or(VestingError::Underflow)?;

            let recorded_vesting_balance_changed = stake_account_metadata
                .update_recorded_vesting_balance(new_recorded_vesting_balance);

            transfer_vesting_events.stake_account_metadata = Some(StakeAccountMetadataEvents {
                recorded_vesting_balance_changed,
                delegate_votes_changed,
            });
        }

        self.new_vest.set_inner(Vesting {
            vester_ta: self.new_vester_ta.key(),
            config: self.vest.config,
            amount: self
                .new_vest
                .amount
                .checked_add(self.vest.amount)
                .ok_or(VestingError::Overflow)?,
            maturation: self.vest.maturation,
            bump: new_vest_bump,
        });

        self.new_vesting_balance.set_inner(VestingBalance {
            vester: self.new_vester_ta.owner.key(),
            stake_account_metadata: self.new_vesting_balance.stake_account_metadata,
            total_vesting_balance: self
                .new_vesting_balance
                .total_vesting_balance
                .checked_add(self.vest.amount)
                .ok_or(VestingError::Overflow)?,
            bump: new_vesting_balance_bump,
            rent_payer: if self.new_vesting_balance.rent_payer == Pubkey::default() {
                self.vester.key()
            } else {
                self.new_vesting_balance.rent_payer
            },
        });

        self.vesting_balance.total_vesting_balance = self
            .vesting_balance
            .total_vesting_balance
            .checked_sub(self.vest.amount)
            .ok_or(VestingError::Underflow)?;

        Ok(transfer_vesting_events)
    }
}
