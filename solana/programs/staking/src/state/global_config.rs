use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct GlobalConfig {
    pub bump: u8,
    pub freeze: bool,
    //     #[cfg(feature = "mock-clock")]
    pub mock_clock_time: i64,
    pub governance_authority: Pubkey,
    pub wh_token_mint: Pubkey,
    pub pda_authority: Pubkey, // Authority that can authorize the transfer of locked tokens
    pub agreement_hash: [u8; 32],
}

impl GlobalConfig {
    pub const LEN: usize = 8 + 8 + 8 + 32 + 32 + 32 + 32; // == 152
}

#[cfg(test)]
pub mod tests {
    use super::GlobalConfig;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            size_of::<GlobalConfig>()
                + GlobalConfig::discriminator().len()
                == GlobalConfig::LEN
        );
    }
}
