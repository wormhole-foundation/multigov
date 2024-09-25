use anchor_lang::prelude::*;

#[account]
pub struct VestingBalance {
    pub vester: Pubkey,
    pub total_vesting_balance: u64,
    pub bump: u8,
    pub stake_account_metadata: Pubkey,
}

impl Space for VestingBalance {
    const INIT_SPACE: usize = 8 + 32 + 8 + 1 + 32;
}
