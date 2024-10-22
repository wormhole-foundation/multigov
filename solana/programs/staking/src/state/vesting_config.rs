use anchor_lang::prelude::*;

#[account]
pub struct VestingConfig {
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub recovery: Pubkey,
    pub seed: u64,
    pub vested: u64,
    pub finalized: bool,
    pub bump: u8,
}

impl Space for VestingConfig {
    const INIT_SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8;
}

#[cfg(test)]
pub mod tests {
    use super::VestingConfig;
    use anchor_lang::Discriminator;
    use anchor_lang::Space;

    #[test]
    fn check_size() {
        assert!(
            size_of::<VestingConfig>() + VestingConfig::discriminator().len() == VestingConfig::INIT_SPACE
        );
    }
}
