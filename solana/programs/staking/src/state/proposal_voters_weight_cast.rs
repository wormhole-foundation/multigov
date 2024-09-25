use crate::Pubkey;
use anchor_lang::account;
use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(BorshSchema)]
pub struct ProposalVotersWeightCast {
    pub proposal_id: [u8; 32],
    pub voter: Pubkey,
    pub value: u64,
}

impl ProposalVotersWeightCast {
    pub const LEN: usize = 8 + 32 + 32 + 8;

    pub fn initialize(&mut self, proposal_id: [u8; 32], voter: &Pubkey) {
        self.proposal_id = proposal_id;
        self.voter = *voter;
        self.value = 0;
    }

    pub fn set(&mut self, new_value: u64) {
        self.value = new_value;
    }
}

#[cfg(test)]
pub mod tests {
    use super::ProposalVotersWeightCast;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            std::mem::size_of::<ProposalVotersWeightCast>()
                + ProposalVotersWeightCast::discriminator().len()
                <= ProposalVotersWeightCast::LEN
        );
    }
}
