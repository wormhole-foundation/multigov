use anchor_lang::prelude::*;

/// Used to store the total vesting balance of a single vester
/// It is also used to delegate vesting
#[account]
#[derive(Default, InitSpace)]
pub struct VestingBalance {
    pub vester: Pubkey,
    pub total_vesting_balance: u64,
    pub bump: u8,
    pub stake_account_metadata: Pubkey,
    pub rent_payer: Pubkey,
}

impl VestingBalance {
    pub const LEN: usize = VestingBalance::DISCRIMINATOR.len() + VestingBalance::INIT_SPACE;
}

#[cfg(test)]
pub mod tests {
    use super::VestingBalance;

    #[test]
    fn check_size() {
        assert!(VestingBalance::LEN == 8 + 32 + 8 + 1 + 32 + 32); // 113
    }
}
