use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema, InitSpace)]
pub struct SpokeAirlock {
    pub bump: u8,
}

impl SpokeAirlock {
    pub const LEN: usize = SpokeAirlock::DISCRIMINATOR.len() + SpokeAirlock::INIT_SPACE;
}

#[cfg(test)]
pub mod tests {
    use super::SpokeAirlock;

    #[test]
    fn check_size() {
        assert!(SpokeAirlock::LEN == 8 + 1); // 9
    }
}
