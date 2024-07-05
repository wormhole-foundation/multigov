use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;
use anchor_lang::account;
use crate::Pubkey;

#[account]
#[derive(BorshSchema)]
pub struct ProposalVotersWeightCast {
    pub proposal_id: u64,
    pub voter:       Pubkey,
    pub value:       u64,
}

impl ProposalVotersWeightCast {
    pub const LEN: usize = 8 + 8 + 32 + 8;

    pub fn initialize(
        &mut self,
        proposal_id: u64,
        voter:       &Pubkey,
    ) {
        self.proposal_id = proposal_id;
        self.voter = *voter;
        self.value = 0;
    }

    pub fn set(
        &mut self,
        new_value: u64
    ) {
        self.value = new_value;
    }
}
