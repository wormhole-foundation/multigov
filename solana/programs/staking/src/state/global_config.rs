use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct GlobalConfig {
    pub bump: u8,
    pub governance_authority: Pubkey,
    pub wh_token_mint: Pubkey,
    pub freeze: bool,
    pub pda_authority: Pubkey, // Authority that can authorize the transfer of locked tokens
    pub agreement_hash: [u8; 32],

    //     #[cfg(feature = "mock-clock")]
    pub mock_clock_time: i64, /* this field needs to be greater than 0 otherwise the API
                               * will use real time */
}

impl GlobalConfig {
    pub const LEN: usize = 8 + 8 + 32 + 32 + 8 + 32 + 32 + 8; // == 160
}

#[cfg(test)]
pub mod tests {
    use super::GlobalConfig;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            std::mem::size_of::<GlobalConfig>()
                + GlobalConfig::discriminator().len()
                + 8 // mock_clock_time 
                == GlobalConfig::LEN
        );
    }
}
