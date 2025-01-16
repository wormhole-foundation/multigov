use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;
use std::mem::size_of;

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct GlobalConfig {
    pub bump: u8,
    // Maximum number of checkpoints that can be stored in a single account
    pub max_checkpoints_account_limit: u32,
    pub governance_authority: Pubkey,
    pub voting_token_mint: Pubkey,
    pub vesting_admin: Pubkey,
    // Pending new admins (before claiming ownership)
    pub pending_vesting_admin: Option<Pubkey>,
    pub pending_governance_authority: Option<Pubkey>,
}

impl GlobalConfig {
    pub const LEN: usize = GlobalConfig::DISCRIMINATOR.len() + size_of::<GlobalConfig>();
}

#[cfg(test)]
pub mod tests {
    use super::GlobalConfig;

    #[test]
    fn check_size() {
        assert!(GlobalConfig::LEN == 8 + 8 + 32 + 32 + 32 + 32 + 32) // == 176
    }
}
