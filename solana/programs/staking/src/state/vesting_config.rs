use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VestingConfig {
    pub mint: Pubkey,
    pub recovery: Pubkey,
    pub seed: u64,
    pub vested: u64,
    pub finalized: bool,
    pub bump: u8,
}

impl VestingConfig {
    pub const LEN: usize = VestingConfig::DISCRIMINATOR.len() + VestingConfig::INIT_SPACE;
}

#[cfg(test)]
pub mod tests {
    use super::VestingConfig;

    #[test]
    fn check_size() {
        assert!(VestingConfig::LEN == 8 + 32 + 32 + 8 + 8 + 1 + 1); // 90
    }
}
