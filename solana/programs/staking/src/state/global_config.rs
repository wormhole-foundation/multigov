use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct GlobalConfig {
    pub bump: u8,
    // Maximum number of checkpoints that can be stored in a single account
    pub max_checkpoints_account_limit: u32,
    pub governance_authority: Pubkey,
    pub wh_token_mint: Pubkey,
    pub vesting_admin: Pubkey,
}

impl GlobalConfig {
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32; // == 112
}

#[cfg(test)]
pub mod tests {
    use super::GlobalConfig;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(size_of::<GlobalConfig>() + GlobalConfig::DISCRIMINATOR.len() == GlobalConfig::LEN);
    }
}
