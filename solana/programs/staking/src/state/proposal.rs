pub struct Proposal {
    pub id:            u64,
    pub against_votes: u64,
    pub for_votes:     u64,
    pub abstain_votes: u64,
    pub voteStart:     u64,
}

impl Proposal {
    pub const LEN: usize = 8 + 4 * 8;

    pub fn initialize(
        &mut self,
        voteStart: u64,
    ) {
        self.id = 0;
        self.against_votes = 0;
        self.for_votes = 0;
        self.abstain_votes = 0;
    }
}
