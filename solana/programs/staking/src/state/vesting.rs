use anchor_lang::prelude::*;
use std::mem::size_of;

#[account]
pub struct Vesting {
    pub vester_ta: Pubkey,
    pub config: Pubkey,
    pub amount: u64,
    pub maturation: i64,
    pub bump: u8,
}

impl Space for Vesting {
    const INIT_SPACE: usize = Vesting::DISCRIMINATOR.len() + size_of::<Vesting>();
}

#[cfg(test)]
pub mod tests {
    use super::Vesting;
    use anchor_lang::Space;

    #[test]
    fn check_size() {
        assert!(Vesting::INIT_SPACE == 8 + 32 + 32 + 8 + 8 + 8); // 96
    }
}
