use anchor_lang::prelude::*;

#[account]
pub struct Vesting {
    pub vester_ta: Pubkey,
    pub config: Pubkey,
    pub amount: u64,
    pub maturation: i64,
    pub bump: u8,
}

impl Space for Vesting {
    const INIT_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8;
}

#[cfg(test)]
pub mod tests {
    use super::Vesting;
    use anchor_lang::Discriminator;
    use anchor_lang::Space;

    #[test]
    fn check_size() {
        assert!(size_of::<Vesting>() + Vesting::discriminator().len() == Vesting::INIT_SPACE);
    }
}
