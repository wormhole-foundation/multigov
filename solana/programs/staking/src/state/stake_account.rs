use crate::error::ErrorCode;
use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

/// This is the metadata account for each staker
/// It is derived from the checkpoints account with seeds "stake_metadata"
/// and the checkpoints account pubkey
/// It stores some PDA bumps, owner and delegate accounts

#[account]
#[derive(BorshSchema)]
pub struct StakeAccountMetadata {
    pub metadata_bump: u8,
    pub custody_bump: u8,
    pub authority_bump: u8,
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub recorded_balance: u64,
    pub recorded_vesting_balance: u64,
    pub signed_agreement_hash: Option<[u8; 32]>,
}

impl StakeAccountMetadata {
    pub const LEN: usize = 128; // 8 + 3 * 1 + 32 + 32 + 8 + 8 + 32 + 1 + 4

    pub fn check_is_llc_member(&self, expected_agreement_hash: &[u8; 32]) -> Result<()> {
        if let Some(agreement_hash) = self.signed_agreement_hash {
            if agreement_hash == *expected_agreement_hash {
                return Ok(());
            }
        }

        err!(ErrorCode::NotLlcMember)
    }
}

impl StakeAccountMetadata {
    pub fn initialize(
        &mut self,
        metadata_bump: u8,
        custody_bump: u8,
        authority_bump: u8,
        owner: &Pubkey,
    ) {
        self.metadata_bump = metadata_bump;
        self.custody_bump = custody_bump;
        self.authority_bump = authority_bump;
        self.owner = *owner;
        self.delegate = Pubkey::default();
        self.recorded_balance = 0;
        self.recorded_vesting_balance = 0;
        self.signed_agreement_hash = None;
    }
}

#[cfg(test)]
pub mod tests {
    use super::StakeAccountMetadata;
    use anchor_lang::prelude::Pubkey;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            std::mem::size_of::<StakeAccountMetadata>()
                + StakeAccountMetadata::discriminator().len()
                <= StakeAccountMetadata::LEN
        );
    }

    #[test]
    fn check_is_llc_member() {
        let stake_account_metadata_llc_member = StakeAccountMetadata {
            metadata_bump: 0,
            custody_bump: 0,
            authority_bump: 0,
            owner: Pubkey::default(),
            delegate: Pubkey::default(),
            recorded_balance: 0,
            recorded_vesting_balance: 0,
            signed_agreement_hash: Some([0; 32]),
        };
        assert!(stake_account_metadata_llc_member
            .check_is_llc_member(&[0; 32])
            .is_ok());

        assert!(stake_account_metadata_llc_member
            .check_is_llc_member(&[1; 32])
            .is_err());

        let stake_account_metadata_non_llc_member = StakeAccountMetadata {
            metadata_bump: 0,
            custody_bump: 0,
            authority_bump: 0,
            owner: Pubkey::default(),
            delegate: Pubkey::default(),
            recorded_balance: 0,
            recorded_vesting_balance: 0,
            signed_agreement_hash: None,
        };
        assert!(stake_account_metadata_non_llc_member
            .check_is_llc_member(&[0; 32])
            .is_err());
    }
}
