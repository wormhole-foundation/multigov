use anchor_lang::prelude::*;
use std::mem::size_of;

#[account]
pub struct VestingConfig {
    pub mint: Pubkey,
    pub recovery: Pubkey,
    pub seed: u64,
    pub vested: u64,
    pub finalized: bool,
    pub bump: u8,
}

impl Space for VestingConfig {
    const INIT_SPACE: usize = VestingConfig::DISCRIMINATOR.len() + size_of::<VestingConfig>();
}

#[cfg(test)]
pub mod tests {
    use super::VestingConfig;
    use anchor_lang::Space;

    #[test]
    fn check_size() {
        assert!(VestingConfig::INIT_SPACE == 8 + 32 + 32 + 8 + 8 + 8); // 96
    }
}
