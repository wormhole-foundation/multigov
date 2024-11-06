use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct SpokeAirlock {
    pub bump: u8,
}

impl SpokeAirlock {
    pub const LEN: usize = 8 + 1; // 9
}

#[cfg(test)]
pub mod tests {
    use super::SpokeAirlock;
    use anchor_lang::Discriminator;

    #[test]
    fn check_size() {
        assert!(
            std::mem::size_of::<SpokeAirlock>() + SpokeAirlock::DISCRIMINATOR.len()
                == SpokeAirlock::LEN
        );
    }
}
