use anchor_lang::prelude::*;

#[account(zero_copy)]
#[repr(C)]
pub struct ProposalData {
    pub id:            u64,
    pub against_votes: u64,
    pub for_votes:     u64,
    pub abstain_votes: u64,
    pub vote_start:    u64,
}

impl ProposalData {
    pub const LEN: usize = 8 + 4 * 8;

    pub fn initialize(
        &mut self,
        vote_start: u64,
    ) {
        self.id = 0;
        self.against_votes = 0;
        self.for_votes = 0;
        self.abstain_votes = 0;
        self.vote_start = vote_start;
    }

    pub fn proposal_votes(&self) -> Result<Option<(u64, u64, u64)>> {
        Ok(Some((self.against_votes, self.for_votes, self.abstain_votes)))
    }
}

#[cfg(test)]
pub mod tests {
    use crate::state::proposal::ProposalData;

    #[test]
    fn proposal_votes_test() {
        let proposal = &mut ProposalData {
            id:             1,
            against_votes:  50,
            for_votes:      40,
            abstain_votes:  30,
            vote_start:     10,
        };

        assert_eq!(
          proposal.proposal_votes().unwrap(),
          Some((50, 40, 30))
        );
    }
}
