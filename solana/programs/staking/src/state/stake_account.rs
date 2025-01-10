use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;
use std::mem::size_of;

/// This is the metadata account for each staker
/// It is derived from the checkpoints account with seeds "stake_metadata"
/// and the checkpoints account pubkey
/// It stores some PDA bumps, owner and delegate accounts

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct StakeAccountMetadata {
    pub metadata_bump: u8,
    pub custody_bump: u8,
    pub authority_bump: u8,
    pub recorded_balance: u64,
    pub recorded_vesting_balance: u64,
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub stake_account_checkpoints_last_index: u16,
}

#[event]
pub struct RecordedBalanceChanged {
    pub owner: Pubkey,
    pub previous_balance: u64,
    pub new_balance: u64,
}

#[event]
pub struct RecordedVestingBalanceChanged {
    pub owner: Pubkey,
    pub previous_balance: u64,
    pub new_balance: u64,
}

impl StakeAccountMetadata {
    pub const LEN: usize =
        StakeAccountMetadata::DISCRIMINATOR.len() + size_of::<StakeAccountMetadata>();

    pub fn initialize(
        &mut self,
        metadata_bump: u8,
        custody_bump: u8,
        authority_bump: u8,
        owner: &Pubkey,
        delegate: &Pubkey,
        stake_account_checkpoints_last: u16,
    ) {
        self.metadata_bump = metadata_bump;
        self.custody_bump = custody_bump;
        self.authority_bump = authority_bump;
        self.owner = *owner;
        self.delegate = *delegate;
        self.stake_account_checkpoints_last_index = stake_account_checkpoints_last;
    }

    pub fn update_recorded_balance(&mut self, new_recorded_balance: u64) -> RecordedBalanceChanged {
        emit!(RecordedBalanceChanged {
            owner: self.owner,
            previous_balance: self.recorded_balance,
            new_balance: new_recorded_balance,
        });

        self.recorded_balance = new_recorded_balance;

        RecordedBalanceChanged {
            owner: self.owner,
            previous_balance: self.recorded_balance,
            new_balance: new_recorded_balance,
        }
    }

    pub fn update_recorded_vesting_balance(
        &mut self,
        new_recorded_vesting_balance: u64,
    ) -> RecordedVestingBalanceChanged {
        emit!(RecordedVestingBalanceChanged {
            owner: self.owner,
            previous_balance: self.recorded_vesting_balance,
            new_balance: new_recorded_vesting_balance,
        });

        self.recorded_vesting_balance = new_recorded_vesting_balance;

        RecordedVestingBalanceChanged {
            owner: self.owner,
            previous_balance: self.recorded_vesting_balance,
            new_balance: new_recorded_vesting_balance,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::StakeAccountMetadata;

    #[test]
    fn check_size() {
        assert!(StakeAccountMetadata::LEN == 8 + 8 + 8 + 8 + 32 + 32); // == 96
    }
}
