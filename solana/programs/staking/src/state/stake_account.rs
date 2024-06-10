use {
    crate::{
        error::ErrorCode,
    },
    anchor_lang::prelude::{
        borsh::BorshSchema,
        *,
    },
};

/// This is the metadata account for each staker
/// It is derived from the positions account with seeds "stake_metadata" and the positions account
/// pubkey It stores some PDA bumps, the owner of the account

#[account]
#[derive(BorshSchema)]
pub struct StakeAccountMetadata {
    pub metadata_bump:         u8,
    pub custody_bump:          u8,
    pub authority_bump:        u8,
    pub voter_bump:            u8,
    pub owner:                 Pubkey,
    pub next_index:            u8,
    pub transfer_epoch:        Option<u64>, // null if the account was created, some epoch if the account received a transfer
    pub signed_agreement_hash: Option<[u8; 32]>,
}

impl StakeAccountMetadata {
    pub const LEN: usize = 200;

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
        voter_bump: u8,
        owner: &Pubkey,
    ) {
        self.metadata_bump = metadata_bump;
        self.custody_bump = custody_bump;
        self.authority_bump = authority_bump;
        self.voter_bump = voter_bump;
        self.owner = *owner;
        self.next_index = 0;
        self.transfer_epoch = None;
        self.signed_agreement_hash = None;
    }
}

#[cfg(test)]
pub mod tests {
    use {
        crate::state::{
            stake_account::StakeAccountMetadata,
        },
        anchor_lang::Discriminator,
        solana_program::pubkey::Pubkey,
    };

    #[test]
    fn check_size() {
        assert!(
            anchor_lang::solana_program::borsh::get_packed_len::<StakeAccountMetadata>()
                + StakeAccountMetadata::discriminator().len()
                <= StakeAccountMetadata::LEN
        );
    }

    #[test]
    fn check_is_llc_member() {
        let stake_account_metadata_llc_member = StakeAccountMetadata {
            metadata_bump:         0,
            custody_bump:          0,
            authority_bump:        0,
            voter_bump:            0,
            owner:                 Pubkey::default(),
            next_index:            0,
            transfer_epoch:        None,
            signed_agreement_hash: Some([0; 32]),
        };
        assert!(stake_account_metadata_llc_member
            .check_is_llc_member(&[0; 32])
            .is_ok());

        assert!(stake_account_metadata_llc_member
            .check_is_llc_member(&[1; 32])
            .is_err());


        let stake_account_metadata_non_llc_member = StakeAccountMetadata {
            metadata_bump:         0,
            custody_bump:          0,
            authority_bump:        0,
            voter_bump:            0,
            owner:                 Pubkey::default(),
            next_index:            0,
            transfer_epoch:        None,
            signed_agreement_hash: None,
        };
        assert!(stake_account_metadata_non_llc_member
            .check_is_llc_member(&[0; 32])
            .is_err());
    }
}
