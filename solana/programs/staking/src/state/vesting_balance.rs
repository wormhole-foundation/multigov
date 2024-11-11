use anchor_lang::prelude::*;

/// Used to store the total vesting balance of a single vester
/// It is also used to delegate vesting
#[account]
pub struct VestingBalance {
    pub vester: Pubkey,
    pub total_vesting_balance: u64,
    pub bump: u8,
    pub stake_account_metadata: Pubkey,
}

impl Space for VestingBalance {
    const INIT_SPACE: usize = 8 + 32 + 8 + 8 + 32;
}

#[cfg(test)]
pub mod tests {
    use super::VestingBalance;
    use anchor_lang::{Discriminator, Space};

    #[test]
    fn check_size() {
        assert!(
            size_of::<VestingBalance>() + VestingBalance::DISCRIMINATOR.len()
                == VestingBalance::INIT_SPACE
        );
    }
}
