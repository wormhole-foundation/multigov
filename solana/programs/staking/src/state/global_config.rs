use {
    anchor_lang::prelude::*,
    borsh::BorshSchema,
};

#[account]
#[derive(Default, BorshSchema)]
pub struct GlobalConfig {
    pub bump:                  u8,
    pub governance_authority:  Pubkey,
    pub epoch_duration:        u64, // epoch duration in seconds
    pub freeze:                bool,
    pub pda_authority:         Pubkey, // Authority that can authorize the transfer of locked tokens
    pub governance_program:    Pubkey, // Governance program id
    pub agreement_hash:       [u8; 32],
}

impl GlobalConfig {
    pub const LEN: usize = 6144;
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
