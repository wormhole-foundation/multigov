use anchor_lang::prelude::*;
use borsh::BorshSchema;

#[account]
#[derive(Default, BorshSchema)]
pub struct GlobalConfig {
    pub bump:                 u8,
    pub governance_authority: Pubkey,
    pub wh_token_mint:        Pubkey,
    pub freeze:               bool,
    pub pda_authority:        Pubkey, // Authority that can authorize the transfer of locked tokens
    pub governance_program:   Pubkey, // Governance program id
    pub agreement_hash:       [u8; 32],

    #[cfg(feature = "mock-clock")]
    pub mock_clock_time: i64, /* this field needs to be greater than 0 otherwise the API
                               * will use real time */
}

impl GlobalConfig {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 8 + 1 + 32 + 32 + 32 + 8;
}

#[cfg(test)]
pub mod tests {
    use crate::state::global_config::GlobalConfig;

    #[test]
    fn check_size() {
        assert!(
            anchor_lang::solana_program::borsh::get_packed_len::<GlobalConfig>()
                < GlobalConfig::LEN
        );
    }
}
