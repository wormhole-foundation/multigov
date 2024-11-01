use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

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
}

impl StakeAccountMetadata {
    pub const LEN: usize = 8 + 8 + 8 + 8 + 32 + 32; // == 96

    pub fn initialize(
        &mut self,
        metadata_bump: u8,
        custody_bump: u8,
        authority_bump: u8,
        owner: &Pubkey,
        delegate: &Pubkey,
    ) {
        self.metadata_bump = metadata_bump;
        self.custody_bump = custody_bump;
        self.authority_bump = authority_bump;
        self.owner = *owner;
        self.delegate = *delegate;
    }
}

#[cfg(test)]
pub mod tests {
    use super::StakeAccountMetadata;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            size_of::<StakeAccountMetadata>() + StakeAccountMetadata::DISCRIMINATOR.len()
                == StakeAccountMetadata::LEN
        );
    }
}
