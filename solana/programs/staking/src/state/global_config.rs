use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct GlobalConfig {
    pub bump: u8,
    pub freeze: bool,

    #[cfg(feature = "mock-clock")]
    pub mock_clock_time: i64,

    pub governance_authority: Pubkey,
    pub wh_token_mint: Pubkey,
    pub vesting_admin: Pubkey,
}

impl GlobalConfig {
    #[cfg(feature = "mock-clock")]
    pub const LEN: usize = 8 + 8 + 8 + 32 + 32 + 32; // == 120

    #[cfg(not(feature = "mock-clock"))]
    pub const LEN: usize = 8 + 2 + 32 + 32 + 32; // == 106
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
