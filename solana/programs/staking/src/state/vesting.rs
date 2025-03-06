use anchor_lang::prelude::*;

#[account]
#[derive(Default, InitSpace)]
pub struct Vesting {
    pub vester_ta: Pubkey,
    pub config: Pubkey,
    pub amount: u64,
    pub maturation: i64,
    pub bump: u8,
}

impl Vesting {
    pub const LEN: usize = Vesting::DISCRIMINATOR.len() + Vesting::INIT_SPACE;
}

#[cfg(test)]
pub mod tests {
    use super::Vesting;

    #[test]
    fn check_size() {
        assert!(Vesting::LEN == 8 + 32 + 32 + 8 + 8 + 1); // 89
    }
}
