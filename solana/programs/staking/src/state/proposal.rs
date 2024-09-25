use crate::error::ErrorCode;
use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Debug, BorshSchema)]
pub struct ProposalData {
    pub id: [u8; 32],
    pub against_votes: u64,
    pub for_votes: u64,
    pub abstain_votes: u64,
    pub vote_start: u64,
    pub safe_window: u64,
}

impl ProposalData {
    pub const LEN: usize = 10240; // 8 + 6 * 8;

    fn initialize(&mut self, proposal_id: [u8; 32], vote_start: u64, safe_window: u64) {
        self.id = proposal_id;
        self.against_votes = 0;
        self.for_votes = 0;
        self.abstain_votes = 0;
        self.vote_start = vote_start;
        self.safe_window = safe_window;
    }

    pub fn add_proposal(
        &mut self,
        proposal_id: [u8; 32],
        vote_start: u64,
        safe_window: u64,
    ) -> anchor_lang::Result<()> {
        require!(self.vote_start == 0, ErrorCode::ProposalAlreadyExists);
        self.initialize(proposal_id, vote_start, safe_window);
        Ok(())
    }

    pub fn proposal_votes(&self) -> Result<Option<([u8; 32], u64, u64, u64)>> {
        Ok(Some((
            self.id,
            self.against_votes,
            self.for_votes,
            self.abstain_votes,
        )))
    }

    pub fn is_voting_safe(&self, timestamp: u64) -> Result<bool> {
        Ok((self.vote_start + self.safe_window) >= timestamp)
    }
}

#[cfg(test)]
pub mod tests {
    use super::ProposalData;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            size_of::<ProposalData>() + ProposalData::discriminator().len() <= ProposalData::LEN
        );
    }

    #[test]
    fn proposal_votes_test() {
        let proposal_id: [u8; 32] = [1; 32];
        let proposal = &mut ProposalData {
            id: proposal_id,
            against_votes: 50,
            for_votes: 40,
            abstain_votes: 30,
            vote_start: 10,
            safe_window: 50,
        };

        assert_eq!(
            proposal.proposal_votes().unwrap(),
            Some((proposal_id, 50, 40, 30))
        );
    }
}
