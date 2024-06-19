use {
    super::global_config::GlobalConfig,
    anchor_lang::prelude::{
        borsh::BorshSchema,
        *,
    },
};

/// The governance action VoterWeight is evaluated for
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, BorshSchema)]
pub enum VoterWeightAction {
    /// Cast vote for a proposal. Target: Proposal
    CastVote,

    /// Create Governance within a realm. Target: Realm
    CreateGovernance,

    /// Create a proposal for a governance. Target: Governance
    CreateProposal,
}

/// VoterWeightRecord account
#[account]
#[derive(BorshSchema)]
pub struct VoterWeightRecord {
    /// The Realm the VoterWeightRecord belongs to
    pub realm: Pubkey,

    /// Governing Token Mint the VoterWeightRecord is associated with
    // The mint here is to link the record to either community or council mint of the realm
    pub governing_token_mint: Pubkey,

    /// The owner of the governing token and voter
    /// This is the actual owner (voter) and corresponds to
    /// TokenOwnerRecord.governing_token_owner
    pub governing_token_owner: Pubkey,

    /// Voter's weight
    pub voter_weight: u64,

    /// The governance action the voter's weight pertains to
    /// It allows to provided voter's weight specific to the particular action
    /// the weight is evaluated for.
    pub weight_action: Option<VoterWeightAction>,

    /// The target the voter's weight  action pertains to
    /// It allows to provided voter's weight specific to the target the weight
    /// is evaluated for. For example when addin supplies weight to vote on a
    /// particular proposal then it must specify the proposal as the action
    /// target.
    pub weight_action_target: Option<Pubkey>,

    /// Reserved space for future versions
    pub reserved: [u8; 8],
}

impl VoterWeightRecord {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 2 + 33 + 8;

    pub fn initialize(&mut self, config: &GlobalConfig, owner: &Pubkey) {
        self.realm = config.wh_governance_realm;
        self.governing_token_mint = config.wh_token_mint;
        self.governing_token_owner = *owner;
    }
}

#[cfg(test)]
pub mod tests {
    use {
        crate::state::voter_weight_record::VoterWeightRecord,
        anchor_lang::Discriminator,
    };

    #[test]
    fn check_size() {
        assert_eq!(
            anchor_lang::solana_program::borsh::get_packed_len::<VoterWeightRecord>()
                + VoterWeightRecord::discriminator().len(),
            VoterWeightRecord::LEN
        );
    }
}
